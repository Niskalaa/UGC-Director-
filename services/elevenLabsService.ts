
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string;
}

export interface ElevenLabsSettings {
  model_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (Best Quality)' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (Fastest)' },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5 (Low Latency)' },
  { id: 'eleven_monolingual_v1', name: 'English v1 (Standard)' }
];

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

export const generateElevenLabsSpeech = async (text: string, voiceId: string, settings?: ElevenLabsSettings): Promise<string> => {
  const apiKey = getElevenLabsKey();
  if (!apiKey) throw new Error("ElevenLabs API Key is missing");

  const modelId = settings?.model_id || "eleven_multilingual_v2";

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: text,
      model_id: modelId,
      voice_settings: {
        stability: settings?.stability ?? 0.5,
        similarity_boost: settings?.similarity_boost ?? 0.75,
        style: settings?.style ?? 0.0,
        use_speaker_boost: settings?.use_speaker_boost ?? true
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
