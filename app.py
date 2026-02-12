import os
import uuid
import requests
import boto3
from io import BytesIO
from flask import Flask, request, jsonify
from supabase import create_client, Client
import google.generativeai as genai
from openai import OpenAI

app = Flask(__name__)

# --- 1. KONFIGURASI MODEL ---
# Gunakan 'gemini-3-pro' jika sudah tersedia di region-mu, 
# atau 'gemini-2.0-pro-exp' untuk performa tertinggi saat ini.
MODEL_NAME = "gemini-2.0-pro-exp-02-05" 

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini = genai.GenerativeModel(MODEL_NAME)

# OpenRouter (Untuk Image/Video Generation)
openrouter = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

# Supabase & S3
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
s3 = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'ap-southeast-1')
)

# --- 2. LOGIKA STORAGE ---

def process_to_s3(temp_url):
    """Mengamankan file dari OpenRouter ke AWS S3"""
    try:
        res = requests.get(temp_url, timeout=60)
        if res.status_code != 200: return None
        
        file_path = f"outputs/{uuid.uuid4()}.png"
        bucket = os.getenv('S3_BUCKET_NAME')
        
        s3.upload_fileobj(
            BytesIO(res.content),
            bucket,
            file_path,
            ExtraArgs={'ContentType': 'image/png'}
        )
        return f"https://{bucket}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{file_path}"
    except Exception as e:
        print(f"S3 Error: {e}")
        return None

# --- 3. ENDPOINT GENERATE ---

@app.route('/health')
def health(): return jsonify({"status": "online"}), 200

@app.route('/generate', methods=['POST'])
def generate_ugc():
    payload = request.json
    raw_prompt = payload.get('prompt')
    
    if not raw_prompt:
        return jsonify({"error": "Prompt is required"}), 400

    try:
        # STEP 1: Gemini Pro sebagai Creative Director
        # Model ini akan membuat instruksi visual yang sangat teknis (lighting, camera angle, texture)
        instruction = (
            f"Transform this user idea into a hyper-detailed prompt for an AI Image Generator. "
            f"Include lighting, camera lens (85mm), and artistic style. Idea: {raw_prompt}"
        )
        ai_response = gemini.generate_content(instruction)
        detailed_visual_prompt = ai_response.text

        # STEP 2: OpenRouter sebagai Mesin Produksi
        # Kita panggil model image/video terbaik via OpenRouter
        production_res = openrouter.chat.completions.create(
            model="google/gemini-2.0-pro-exp-02-05:free", # Model image generation pilihan
            messages=[{"role": "user", "content": detailed_visual_prompt}]
        )
        temp_media_url = production_res.choices[0].message.content

        # STEP 3: Permanensi Data (S3 & Supabase)
        final_url = process_to_s3(temp_media_url)
        
        if final_url:
            supabase.table("generations").insert({
                "original_prompt": raw_prompt,
                "ai_refined_prompt": detailed_visual_prompt,
                "storage_url": final_url,
                "model_used": MODEL_NAME
            }).execute()

            return jsonify({"url": final_url, "prompt_used": detailed_visual_prompt}), 200
        
        return jsonify({"error": "Storage upload failed"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
