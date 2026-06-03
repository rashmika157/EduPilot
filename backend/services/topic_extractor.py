import fitz
import re
import json
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from backend.config import settings

def clean_and_normalize_title(title: str) -> str:
    if not title:
        return ""
    # Strip leading slide/page/chapter numbers, bullet points, and colons
    cleaned = re.sub(
        r'^(?:Slide|Page|Chapter|Module|Section|Unit|Ch|Mod|Sec|Pg|\d+(?:\.\d+)*)[\s\-_.:,]*', 
        '', 
        title.strip(), 
        flags=re.IGNORECASE
    ).strip()
    return cleaned

def is_structural_title(title: str) -> bool:
    norm = re.sub(r'[\s\-_.:,\d#()\[\]]+', '', title).lower().strip()
    if not norm:
        return True
    structural_words = {
        "slide", "page", "chapter", "module", "section", "unit", "ch", "mod", "sec", "pg", 
        "slides", "pages", "chapters", "modules", "sections", "units", 
        "generalconcepts", "generaltopics", "generalsyllabusconcepts", 
        "introduction", "overview", "summary", "conclusion", "tableofcontents", "contents", "index",
        "keyoverview", "corevocabulary", "concepttopics", "conceptblocks"
    }
    if norm in structural_words:
        return True
    return False

def post_process_topics(extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    topics_map = {}
    
    for t in extracted_data.get("topics", []):
        raw_title = t.get("title", "")
        cleaned_title = clean_and_normalize_title(raw_title)
        
        if not cleaned_title or is_structural_title(cleaned_title):
            continue
            
        topic_key = cleaned_title.lower()
        if topic_key not in topics_map:
            topics_map[topic_key] = {
                "title": cleaned_title,
                "subtopics_map": {}
            }
            
        target_topic = topics_map[topic_key]
        
        for s in t.get("subtopics", []):
            raw_sub = s.get("title", "")
            cleaned_sub = clean_and_normalize_title(raw_sub)
            
            if not cleaned_sub or is_structural_title(cleaned_sub):
                continue
                
            sub_key = cleaned_sub.lower()
            if sub_key not in target_topic["subtopics_map"]:
                target_topic["subtopics_map"][sub_key] = {
                    "title": cleaned_sub,
                    "children_map": {}
                }
                
            target_sub = target_topic["subtopics_map"][sub_key]
            
            for c in s.get("children", []):
                raw_child = c.get("title", "")
                cleaned_child = clean_and_normalize_title(raw_child)
                
                if not cleaned_child or is_structural_title(cleaned_child):
                    continue
                    
                child_key = cleaned_child.lower()
                if child_key not in target_sub["children_map"]:
                    target_sub["children_map"][child_key] = {
                        "title": cleaned_child
                    }
                    
    # Format maps back to nested lists
    final_topics = []
    for t_key, t_val in topics_map.items():
        subtopics = []
        for s_key, s_val in t_val["subtopics_map"].items():
            children = []
            for c_key, c_val in s_val["children_map"].items():
                children.append({"title": c_val["title"]})
            subtopics.append({
                "title": s_val["title"],
                "children": children
            })
        final_topics.append({
            "title": t_val["title"],
            "subtopics": subtopics
        })
        
    return {
        "confidence_score": extracted_data.get("confidence_score", 0.75),
        "topics": final_topics
    }

def extract_topics_from_pdf(file_path: str) -> Dict[str, Any]:
    """
    Extracts topics and subtopics from a PDF file.
    If GEMINI_API_KEY is configured, it uses Gemini to generate a high-quality hierarchical syllabus.
    Otherwise, it falls back to local PyMuPDF heuristics.
    """
    raw_data = None
    if settings.GEMINI_API_KEY:
        print("[AI] GEMINI_API_KEY detected. Starting AI-powered topic extraction...")
        try:
            raw_data = extract_topics_with_gemini(file_path)
        except Exception as e:
            print(f"[AI] Gemini topic extraction failed: {e}. Falling back to heuristics...")
            
    if not raw_data:
        print("[WARNING] Falling back to local heuristics...")
        raw_data = extract_topics_with_heuristics(file_path)
        
    return post_process_topics(raw_data)


def extract_topics_with_gemini(file_path: str) -> Dict[str, Any]:
    # Configure Gemini
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    # 1. Open PDF and extract text up to 30 pages
    try:
        doc = fitz.open(file_path)
    except Exception as e:
        print(f"Error opening PDF {file_path}: {e}")
        return {"confidence_score": 0.0, "topics": []}
        
    text_content = []
    # Read all pages of the document to analyze the complete content
    for page_idx in range(len(doc)):
        text_content.append(doc[page_idx].get_text("text"))
    doc.close()
    
    full_text = "\n".join(text_content)
    
    # Clean text slightly to fit prompt size
    full_text = re.sub(r'\n\s*\n', '\n', full_text)
    
    # 2. Build structured prompt
    prompt = f"""
You are an expert academic curriculum analyst.
Analyze the following textbook/lecture notes text and generate a detailed hierarchical syllabus/topic structure of the concepts actually taught in the document.

Requirements:
1. Ignore slide numbers (e.g., "Slide 1", "Slide 2"), page numbers, chapter labels, headers, footers, and presentation structures.
2. Focus on extracting the actual core academic concepts and learning topics being taught.
3. Group related concepts under parent topics to generate a clean, syllabus-style hierarchy.
4. Merge repeated concepts across slides/pages into single, consolidated topic/subtopic nodes.
5. Create meaningful subtopics and children/sub-subtopics based on the content being taught (e.g., "Mass Storage Systems" -> "Disk Scheduling" -> ["FCFS", "SSTF", "SCAN", "C-SCAN"]).
6. Keep topic and subtopic titles concise and professional.
7. Generate an overall extraction confidence score between 0.0 and 1.0.

Output MUST be a JSON object matching the following structure:
{{
  "confidence_score": 0.95,
  "topics": [
    {{
      "title": "Topic Name (e.g. Mass Storage Systems)",
      "subtopics": [
        {{
          "title": "Subtopic Name (e.g. Disk Scheduling)",
          "children": [
            {{
              "title": "Sub-subtopic Name (e.g. FCFS)"
            }}
          ]
        }}
      ]
    }}
  ]
}}

Here is the full notes text:
---
{full_text[:500000]}
---
"""

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    
    result = json.loads(response.text)
    
    # Sanitize and validate structural consistency
    topics = []
    confidence_score = float(result.get("confidence_score", 0.85))
    
    for t in result.get("topics", []):
        topic_title = t.get("title", "").strip()
        if not topic_title:
            continue
        
        subtopics = []
        for s in t.get("subtopics", []):
            sub_title = s.get("title", "").strip()
            if not sub_title:
                continue
            
            children = []
            for c in s.get("children", []):
                child_title = c.get("title", "").strip()
                if child_title:
                    children.append({"title": child_title})
                    
            subtopics.append({
                "title": sub_title,
                "children": children
            })
            
        topics.append({
            "title": topic_title,
            "subtopics": subtopics
        })
        
    return {
        "confidence_score": confidence_score,
        "topics": topics
    }


def is_structural_title(title: str) -> bool:
    # Normalize string by removing digits, punctuation, and spaces
    norm = re.sub(r'[\s\-_.:,\d#()\[\]]+', '', title).lower().strip()
    if not norm:
        return True
    # Filter common structural names or slides, chapters, modules, etc.
    if re.match(r'^(slide|page|chapter|module|section|unit|ch|mod|sec|pg|slides|pages|chapters|modules|sections|units)$', norm):
        return True
    if norm in ["introduction", "overview", "summary", "conclusion", "tableofcontents", "contents", "index"]:
        return True
    return False


def extract_topics_with_heuristics(file_path: str) -> Dict[str, Any]:
    topics = []
    
    try:
        doc = fitz.open(file_path)
    except Exception as e:
        print(f"Error opening PDF {file_path}: {e}")
        return {"confidence_score": 0.0, "topics": []}
        
    try:
        # 1. Try to read Table of Contents (Outline)
        toc = doc.get_toc()
        if toc:
            current_topic = None
            for item in toc:
                if len(item) < 2:
                    continue
                level = item[0]
                title = item[1].strip()
                
                if not title or len(title) < 2 or is_structural_title(title):
                    continue
                
                if level == 1:
                    clean_title = re.sub(r'^(?:(?:Chapter|Section|Unit|Module)\s+\d+[:.]?\s*|(?:\d+\.\d*(?:\.\d+)*)\s+)', '', title, flags=re.IGNORECASE).strip()
                    if not clean_title or is_structural_title(clean_title):
                        clean_title = title
                    
                    current_topic = {"title": clean_title[:150], "subtopics": []}
                    topics.append(current_topic)
                elif level >= 2:
                    if current_topic is None:
                        current_topic = {"title": "General Syllabus Concepts", "subtopics": []}
                        topics.append(current_topic)
                    
                    clean_sub = re.sub(r'^(?:\d+(?:\.\d+)*\s*)', '', title).strip()
                    if not clean_sub or is_structural_title(clean_sub):
                        clean_sub = title
                        
                    if clean_sub[:150] not in current_topic["subtopics"] and not is_structural_title(clean_sub):
                        current_topic["subtopics"].append(clean_sub[:150])
                        
        # 2. Heuristic fallback if TOC is empty or too short
        if len(topics) < 2:
            topics = []
            font_sizes = []
            
            sample_pages = min(5, len(doc))
            for page_idx in range(sample_pages):
                page = doc[page_idx]
                blocks = page.get_text("dict")["blocks"]
                for b in blocks:
                    if "lines" in b:
                        for l in b["lines"]:
                            for s in l["spans"]:
                                text = s["text"].strip()
                                if text and len(text) > 3 and len(text) < 100:
                                    font_sizes.append(round(s["size"], 1))
                                    
            if font_sizes:
                from collections import Counter
                size_counts = Counter(font_sizes)
                body_size = size_counts.most_common(1)[0][0] if size_counts else 10.0
            else:
                body_size = 10.0
                
            current_topic = None
            seen_topics = set()
            seen_subtopics = set()
            
            search_pages = min(30, len(doc)) # Check more pages to extract completely
            for page_idx in range(search_pages):
                page = doc[page_idx]
                blocks = page.get_text("dict")["blocks"]
                for b in blocks:
                    if "lines" in b:
                        for l in b["lines"]:
                            for s in l["spans"]:
                                text = s["text"].strip()
                                size = round(s["size"], 1)
                                is_bold = bool(s["flags"] & 16)
                                
                                if not text or len(text) < 4 or len(text) > 120 or is_structural_title(text):
                                    continue
                                if text.isdigit():
                                    continue
                                    
                                clean_text = re.sub(r'^(?:(?:\d+\.)+\d*\s*|[-•*]\s*)', '', text).strip()
                                if not clean_text or len(clean_text) < 3 or is_structural_title(clean_text):
                                    continue
                                    
                                if size >= body_size + 3 or (size >= body_size + 1 and is_bold):
                                    is_major = size >= body_size + 5 or bool(re.match(r'^(?:Chapter|Unit|Module|Section)\b', clean_text, re.IGNORECASE))
                                    
                                    if is_major:
                                        if clean_text.lower() not in seen_topics:
                                            current_topic = {"title": clean_text[:150], "subtopics": []}
                                            topics.append(current_topic)
                                            seen_topics.add(clean_text.lower())
                                    else:
                                        if current_topic is None:
                                            current_topic = {"title": "General Topics", "subtopics": []}
                                            topics.append(current_topic)
                                            seen_topics.add("general topics")
                                            
                                        sub_key = (current_topic["title"].lower(), clean_text.lower())
                                        if sub_key not in seen_subtopics:
                                            current_topic["subtopics"].append(clean_text[:150])
                                            seen_subtopics.add(sub_key)
                                            
        # 3. Ultimate Fallback
        if not topics:
            for page_idx in range(min(15, len(doc))):
                page = doc[page_idx]
                text = page.get_text("text")
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                
                page_topic = f"Concept Topic {page_idx + 1}"
                for l in lines[:3]:
                    if 5 < len(l) < 60 and not l.endswith('.') and not is_structural_title(l):
                        page_topic = l
                        break
                
                page_topic = re.sub(r'^(?:(?:\d+\.)+\d*\s*|[-•*]\s*)', '', page_topic).strip()
                if is_structural_title(page_topic):
                    page_topic = f"Concept Block {page_idx + 1}"
                
                subtopics = []
                for l in lines[3:15]:
                    if 10 < len(l) < 80 and not l.endswith('.') and not any(c.isdigit() for c in l[:2]):
                        clean_l = re.sub(r'^(?:[-•*]\s*)', '', l).strip()
                        if clean_l and clean_l not in subtopics and not is_structural_title(clean_l):
                            subtopics.append(clean_l[:150])
                            if len(subtopics) >= 4:
                                break
                                
                if not subtopics:
                    subtopics = ["Core Concept Study", "Topic Summary Notes"]
                    
                topics.append({"title": page_topic[:150], "subtopics": subtopics})

    except Exception as e:
        print(f"Failed during heuristic topic extraction processing: {e}")
    finally:
        if 'doc' in locals():
            doc.close()
            
    # Format to match new response structure
    final_topics = []
    for t in topics[:15]:
        subs = [s for s in t["subtopics"] if s and s.lower() != t["title"].lower() and not is_structural_title(s)][:10]
        if not subs:
            subs = ["General Concepts"]
        final_topics.append({
            "title": t["title"],
            "subtopics": [{"title": s, "children": []} for s in subs]
        })
        
    return {
        "confidence_score": 0.65, # Standard confidence for local heuristic scans
        "topics": final_topics
    }
