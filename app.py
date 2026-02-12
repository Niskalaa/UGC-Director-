import os
from flask import Flask, request, jsonify
import google.generativeai as genai
from openai import OpenAI
from supabase import create_client

app = Flask(__name__)

# Konfigurasi API dari Environment Variables AWS
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
openrouter_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

@app.route('/')
def health_check():
    return "Aplikasi Image Generator Aktif!", 200

@app.route('/generate', methods=['POST'])
def generate_content():
    user_input = request.json.get('prompt')
    
    # 1. Tanya Gemini untuk memperhalus prompt
    model = genai.GenerativeModel('gemini-1.5-flash')
    refined_prompt = model.generate_content(f"Jelaskan secara visual detail: {user_input}").text
    
    # 2. Kirim ke OpenRouter untuk Generate Image/Video
    response = openrouter_client.chat.completions.create(
        model="google/gemini-2.0-pro-exp-02-05:free", # Ganti ke model image/video pilihanmu
        messages=[{"role": "user", "content": refined_prompt}]
    )
    media_url = response.choices[0].message.content
    
    # 3. Simpan metadata ke Supabase
    supabase.table("generations").insert({"prompt": user_input, "url": media_url}).execute()
    
    return jsonify({"status": "success", "url": media_url})

if __name__ == '__main__':
    # Port harus 8080 sesuai Docker & AWS
    app.run(host='0.0.0.0', port=8080)
