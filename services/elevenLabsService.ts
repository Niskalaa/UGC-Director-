
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string;
}

const getElevenLabsKey = () => localStorage.getItem('ELEVENLABS_API_KEY') || "";

export const fetchElevenLabsVoices = async (): Promise<ElevenLabsVoice[]> => {
  const apiKey = getElevenLabsKey();
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (!response.ok) throw new Error('Failed to fetch voices');
    
    const data = await response.json();
    return data.voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      preview_url: v.preview_url
    }));
  } catch (error) {
    console.error("ElevenLabs Fetch Error:", error);
    return [];
  }
};

export const generateElevenLabsSpeech = async (text: string, voiceId: string): Promise<string> => {
  const apiKey = getElevenLabsKey();
  if (!apiKey) throw new Error("ElevenLabs API Key is missing");

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail?.message || "ElevenLabs Generation Failed");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
