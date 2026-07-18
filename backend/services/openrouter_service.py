import httpx
import json
import re
from typing import Any
from backend.config import settings

def call_openrouter(prompt: str, system_prompt: str = None, json_mode: bool = False) -> str:
    """
    Sends a request to the OpenRouter chat completions API using the deepseek/deepseek-chat model.
    """
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API Key is not configured on the backend. Please add OPENROUTER_API_KEY to your backend/.env file.")
        
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "EduPilot"
    }
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    payload = {
        "model": "deepseek/deepseek-chat",
        "messages": messages
    }
    
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        
    try:
        response = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=120.0
        )
    except Exception as e:
        raise ValueError(f"HTTP request to OpenRouter failed: {str(e)}")
        
    # Check status code before parsing
    if response.status_code != 200:
        # Try to extract JSON error message, otherwise fallback to raw text
        try:
            err_data = response.json()
            err_msg = err_data.get("error", {}).get("message", response.text)
        except Exception:
            err_msg = response.text
        raise ValueError(f"OpenRouter API returned status code {response.status_code}: {err_msg}")
        
    # Check if the response body is valid JSON
    try:
        data = response.json()
    except Exception:
        raise ValueError(f"OpenRouter response is not valid JSON: {response.text}")
        
    # Parse using official OpenRouter structure: choices[0].message.content
    if "choices" not in data or not data["choices"]:
        raise ValueError(f"OpenRouter response is missing 'choices': {data}")
        
    choice = data["choices"][0]
    if "message" not in choice or "content" not in choice["message"]:
        raise ValueError(f"OpenRouter response choice is missing message content: {data}")
        
    content = choice["message"]["content"]
    if content is None:
        raise ValueError(f"OpenRouter returned empty content: {data}")
        
    return content

def parse_json_content(content_str: str) -> Any:
    """
    Cleans and parses a JSON string response from an LLM, removing markdown code block wrappers if present.
    """
    cleaned = content_str.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
        cleaned = cleaned.strip()
        
    try:
        return json.loads(cleaned)
    except Exception as e:
        raise ValueError(f"Failed to parse content as JSON: {content_str}. Error: {str(e)}")
