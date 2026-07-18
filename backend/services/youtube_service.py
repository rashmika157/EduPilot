import requests
import datetime
import json
import re
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from backend.config import settings
from backend.models import YoutubeVideoCache

# NOTE:
# - Removed hardcoded concept fallback list that biased results toward Operating Systems.
# - This service now treats each (note_id, topic_id, subtopic_id) as a unique search key
#   to avoid reusing results across topics.
# - The backend no longer rejects valid public YouTube videos unless they are live,
#   Shorts, private/deleted, or age-restricted.

def generate_relaxed_queries(original_query: str) -> List[str]:
    clean_query = original_query.strip()
    if not clean_query:
        return []

    tokens = clean_query.split()
    if len(tokens) <= 1:
        return [clean_query]

    variants = [clean_query]
    relax_keywords = {"tutorial", "lecture", "explanation", "guide", "introduction", "concept", "components", "component", "architecture", "design", "overview", "fundamentals", "basics", "principles"}
    stopwords = {"of", "the", "a", "an", "and", "or", "for", "with", "in", "on", "at", "by", "to"}

    # Remove one relax keyword at a time.
    for i, token in enumerate(tokens):
        if token.lower() in relax_keywords:
            candidate = " ".join(tokens[:i] + tokens[i+1:]).strip()
            if candidate:
                variants.append(candidate)

    # Build a more direct phrase for patterns like "Components of HDFS".
    if len(tokens) >= 3 and tokens[0].lower() in {"components", "component", "parts"} and tokens[1].lower() == "of":
        direct = " ".join(tokens[2:] + [tokens[0]])
        variants.append(direct)

    # Generate reduced queries by dropping one non-stopword.
    for i, token in enumerate(tokens):
        if token.lower() not in stopwords and len(tokens) - 1 >= 1:
            candidate = " ".join(tokens[:i] + tokens[i+1:]).strip()
            if candidate:
                variants.append(candidate)

    # Add explicit tutorial/lecture/review variants for broader coverage.
    suffixes = ["tutorial", "lecture", "explanation", "overview", "review", "basics", "introduction", "course"]
    for suffix in suffixes:
        candidate = f"{clean_query} {suffix}"
        if candidate not in variants:
            variants.append(candidate)

    # Keep unique and preserve the order of attempts.
    seen = set()
    unique_variants = []
    for q in variants:
        normalized = q.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique_variants.append(normalized)
    return unique_variants


def search_youtube_videos(query: str, db: Session, note_id: Optional[int] = None, topic_id: Optional[int] = None, subtopic_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Searches YouTube for top 5-10 videos matching the query.
    Uses SQLite database caching keyed by a composite key containing the note/topic/subtopic ids.
    """
    clean_query = query.strip()
    composite_key = f"q:{clean_query}|note:{note_id or 'None'}|topic:{topic_id or 'None'}|subtopic:{subtopic_id or 'None'}"

    cached = db.query(YoutubeVideoCache).filter(YoutubeVideoCache.search_query == composite_key).all()
    if cached:
        print(f"[YouTube] Cache hit for composite key: '{composite_key}'")
        return [
            {
                "id": c.video_id,
                "title": c.title,
                "thumbnail_url": c.thumbnail_url,
                "channel_name": c.channel_name,
                "views": c.views,
                "duration": c.duration
            }
            for c in cached
        ]

    print(f"[YouTube] Cache miss for composite key: '{composite_key}' (search='{clean_query}')")
    videos = []
    selected_query = None

    search_queries = generate_relaxed_queries(clean_query)
    if not search_queries:
        search_queries = [clean_query]

    preferred_channels = {
        "neso", "gate smashers", "knowledge gate", "jenny", "freecodecamp",
        "mit opencourseware", "mit ocw", "codehelp", "simplilearn",
        "nptel", "khan academy", "crashcourse", "apna college",
        "codewithharry", "telusko", "edureka", "geekforgeeks", "easy engineering"
    }

    def use_web_search_fallback(query_str: str) -> List[Dict[str, Any]]:
        print(f"[YouTube] Using web search fallback for '{query_str}'")
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            }
            resp = requests.get(
                "https://www.youtube.com/results",
                params={"search_query": query_str, "gl": "US", "hl": "en"},
                headers=headers,
                timeout=10
            )
            if resp.status_code != 200:
                print(f"[YouTube] Web search failed with status {resp.status_code}")
                return []

            html = resp.text
            json_text = None
            match = re.search(r"ytInitialData\s*=\s*({.*?});</script>", html, re.DOTALL)
            if not match:
                match = re.search(r"ytInitialData\s*=\s*({.*?})\s*;", html, re.DOTALL)
            if match:
                json_text = match.group(1)
            else:
                start = html.find("ytInitialData =")
                if start != -1:
                    start = html.index("{", start)
                    brace_count = 0
                    for idx in range(start, len(html)):
                        if html[idx] == '{':
                            brace_count += 1
                        elif html[idx] == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                json_text = html[start:idx+1]
                                break

            if not json_text:
                print("[YouTube] Could not extract ytInitialData from search page")
                return []

            data = json.loads(json_text)
            videos_found = []

            def walk_for_videos(node: Any):
                if isinstance(node, dict):
                    if 'videoRenderer' in node:
                        videos_found.append(node['videoRenderer'])
                    else:
                        for value in node.values():
                            walk_for_videos(value)
                elif isinstance(node, list):
                    for item in node:
                        walk_for_videos(item)

            walk_for_videos(data)

            results = []
            for video in videos_found:
                vid = video.get('videoId')
                if not vid:
                    continue
                snippet = video.get('title', {})
                title = ''
                if isinstance(snippet, dict):
                    title = snippet.get('runs', [{}])[0].get('text', '') or snippet.get('simpleText', '')
                else:
                    title = str(snippet)
                if not title:
                    continue
                channel = ''
                owner = video.get('ownerText', {}).get('runs', [{}])[0].get('text', '')
                if owner:
                    channel = owner
                views = video.get('viewCountText', {}).get('simpleText', '')
                duration = video.get('lengthText', {}).get('simpleText', '')
                if not duration:
                    duration = '0:00'
                results.append({
                    'id': vid,
                    'title': title,
                    'thumbnail_url': f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg',
                    'channel_name': channel,
                    'views': views or 'Unknown views',
                    'duration': duration
                })
                if len(results) >= 10:
                    break

            print(f"[YouTube] Fallback found {len(results)} videos for '{query_str}'")
            return results
        except Exception as e:
            print(f"[YouTube] Web search fallback error: {e}")
            return []

    if not settings.YOUTUBE_API_KEY:
        # Fallback to public web search when no key is configured.
        return use_web_search_fallback(clean_query)

    for attempt_query in search_queries:
        print(f"[YouTube] Search query: '{attempt_query}'")
        try:
            search_url = "https://www.googleapis.com/youtube/v3/search"
            search_params = {
                "part": "snippet",
                "q": attempt_query,
                "maxResults": 20,
                "type": "video",
                "key": settings.YOUTUBE_API_KEY
            }

            search_response = requests.get(search_url, params=search_params, timeout=8)
            items = []
            if search_response.status_code == 200:
                search_data = search_response.json()
                items = search_data.get("items", [])
                print(f"[YouTube] Search response: {len(items)} results for '{attempt_query}'")
            else:
                print(f"[YouTube] Search request failed ({search_response.status_code}) for '{attempt_query}'")
                continue

            if not items:
                print(f"[YouTube] No YouTube results found for '{attempt_query}'")
                continue

            video_ids = [item.get("id", {}).get("videoId") for item in items if item.get("id", {}).get("videoId")]
            if not video_ids:
                print(f"[YouTube] No video IDs found in search results for '{attempt_query}'")
                continue

            details_url = "https://www.googleapis.com/youtube/v3/videos"
            details_params = {
                "part": "contentDetails,statistics,status,snippet",
                "id": ",".join(video_ids),
                "key": settings.YOUTUBE_API_KEY
            }
            details_response = requests.get(details_url, params=details_params, timeout=8)
            details_dict = {}
            if details_response.status_code == 200:
                details_data = details_response.json()
                for v_detail in details_data.get("items", []):
                    details_dict[v_detail["id"]] = {
                        "duration": parse_iso_duration(v_detail["contentDetails"].get("duration", "PT10M")),
                        "views_count": int(v_detail["statistics"].get("viewCount", "0")),
                        "likes_count": int(v_detail["statistics"].get("likeCount", "0")),
                        "views_str": format_view_count(v_detail["statistics"].get("viewCount", "0")),
                        "status": v_detail.get("status", {}),
                        "snippet": v_detail.get("snippet", {}),
                        "content_rating": v_detail.get("contentDetails", {}).get("contentRating", {})
                    }
            else:
                print(f"[YouTube] Video details request failed ({details_response.status_code}) for '{attempt_query}'")
                continue

            candidate_videos = []
            filtered_count = 0

            for item in items:
                item_snippet = item.get("snippet", {})
                video_id = item.get("id", {}).get("videoId")
                skip_reason = None

                if item_snippet.get("liveBroadcastContent") == "live":
                    skip_reason = "live stream"
                elif not video_id:
                    skip_reason = "missing video ID"
                else:
                    v_info = details_dict.get(video_id)
                    if not v_info:
                        skip_reason = "deleted/private/unavailable"
                    else:
                        status_dict = v_info.get("status", {})
                        privacy_status = status_dict.get("privacyStatus", "public")
                        if privacy_status != "public":
                            skip_reason = f"privacy status '{privacy_status}'"

                        content_rating = v_info.get("content_rating", {})
                        if not skip_reason and content_rating and content_rating.get("ytRating") == "ytAgeRestricted":
                            skip_reason = "age-restricted"

                        duration_str = v_info.get("duration", "0:00")
                        duration_mins = get_duration_minutes(duration_str)
                        if not skip_reason and duration_mins < 1.0:
                            skip_reason = "shorts"

                if skip_reason:
                    filtered_count += 1
                    print(f"[YouTube] Skipped {video_id or 'unknown'}: {skip_reason}")
                    continue

                v_info = details_dict.get(video_id)
                snippet_dict = v_info.get("snippet", {})
                title = snippet_dict.get("title", "")
                channel_title = snippet_dict.get("channelTitle", "")
                status_dict = v_info.get("status", {})
                embeddable_flag = status_dict.get("embeddable", True)
                channel_score = 1.0 if any(pc in channel_title.lower() for pc in preferred_channels) else 0.0

                query_words = [w.lower() for w in attempt_query.split() if len(w) > 1]
                matching_words = sum(1 for w in query_words if w in title.lower())
                relevance_score = matching_words / len(query_words) if query_words else 0.0

                candidate_videos.append({
                    "id": video_id,
                    "title": title,
                    "thumbnail_url": snippet_dict.get("thumbnails", {}).get("medium", {}).get("url", ""),
                    "channel_name": channel_title,
                    "views": v_info.get("views_str", "10K views"),
                    "duration": duration_str,
                    "embeddable": embeddable_flag,
                    "relevance_score": relevance_score,
                    "channel_score": channel_score,
                    "views_val": v_info.get("views_count", 0),
                    "likes_val": v_info.get("likes_count", 0)
                })

            print(f"[YouTube] Filtered out {filtered_count} of {len(items)} results for '{attempt_query}'")
            if not candidate_videos:
                print(f"[YouTube] No valid videos remaining after filtering for '{attempt_query}'")
                continue

            ranked_videos = sorted(
                candidate_videos,
                key=lambda x: (
                    x["embeddable"],
                    x["relevance_score"],
                    x["channel_score"],
                    x["views_val"],
                    x["likes_val"]
                ),
                reverse=True
            )

            videos = ranked_videos[:10]
            selected_query = attempt_query
            break

        except Exception as e:
            print(f"[YouTube] API Search failed for '{attempt_query}': {e}")
            continue

    if not videos:
        # If the API key is configured but no embeddable/relevant videos were found,
        # try a public web search fallback for broader coverage.
        for attempt_query in search_queries:
            fallback_videos = use_web_search_fallback(attempt_query)
            if fallback_videos:
                videos = fallback_videos
                selected_query = f"{attempt_query} (web fallback)"
                break

    if not videos:
        print(f"[YouTube] No suitable videos found after fallback searches for original query '{clean_query}'")
        return []

    for v in videos:
        cache_entry = YoutubeVideoCache(
            search_query=composite_key,
            video_id=v["id"],
            title=v["title"],
            thumbnail_url=v["thumbnail_url"],
            channel_name=v["channel_name"],
            views=v["views"],
            duration=v["duration"]
        )
        db.add(cache_entry)

    try:
        db.commit()
        print(f"[YouTube] Cached {len(videos)} videos for query: '{clean_query}' (composite_key='{composite_key}')")
    except Exception as cache_err:
        db.rollback()
        print(f"[YouTube] Caching failed: {cache_err}")

    selected_video_id = videos[0]["id"] if videos else None
    if selected_video_id:
        print(f"[YouTube] Final selected video id={selected_video_id} for query='{selected_query or clean_query}'")

    return [
        {
            "id": v["id"],
            "title": v["title"],
            "thumbnail_url": v["thumbnail_url"],
            "channel_name": v["channel_name"],
            "views": v["views"],
            "duration": v["duration"]
        }
        for v in videos
    ]


def get_duration_minutes(duration_str: str) -> float:
    """
    Helper to convert H:MM:SS or MM:SS to total minutes as float
    """
    try:
        parts = list(map(int, duration_str.split(':')))
        if len(parts) == 3:
            return parts[0] * 60.0 + parts[1] + parts[2] / 60.0
        elif len(parts) == 2:
            return parts[0] + parts[1] / 60.0
        elif len(parts) == 1:
            return parts[0] / 60.0
        return 10.0
    except Exception:
        return 10.0


def parse_iso_duration(duration_str: str) -> str:
    """
    Parses an ISO 8601 duration string (e.g., PT1H23M45S, PT15M) into H:MM:SS or MM:SS
    """
    import re
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if not match:
        return "10:00"
    
    hours, minutes, seconds = match.groups()
    hours = int(hours) if hours else 0
    minutes = int(minutes) if minutes else 0
    seconds = int(seconds) if seconds else 0
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def format_view_count(view_count_str: str) -> str:
    """
    Formats a raw view count string into K or M suffix (e.g., 1250000 -> 1.2M views)
    """
    try:
        views = int(view_count_str)
        if views >= 1000000:
            return f"{views / 1000000:.1f}M views"
        elif views >= 1000:
            return f"{views // 1000}K views"
        return f"{views} views"
    except Exception:
        return "100K views"
