
// Service to handle interactions with Replicate API
// We use a direct fetch approach. Note: In a production environment with strict CORS, 
// these calls should go through your own backend proxy.

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// Models
const MODEL_FLUX_SCHNELL = "black-forest-labs/flux-schnell"; // Fast, high quality
const MODEL_MINIMAX = "minimax/video-01"; // Good text-to-video

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ReplicateResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string[] | string | null;
  error: string | null;
  urls: {
    get: string;
    cancel: string;
  };
}

export const getStoredReplicateKey = () => localStorage.getItem('REPLICATE_API_KEY') || "";

export const setStoredReplicateKey = (key: string) => {
    if (key) localStorage.setItem('REPLICATE_API_KEY', key);
    else localStorage.removeItem('REPLICATE_API_KEY');
};

const pollPrediction = async (predictionUrl: string, token: string): Promise<string> => {
  let status = "starting";
  let logs = "";
  
  while (status !== "succeeded" && status !== "failed" && status !== "canceled") {
    await sleep(1500); // Poll every 1.5s
    
    const response = await fetch(predictionUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) throw new Error("Invalid Replicate API Key");
    
    const data: ReplicateResponse = await response.json();
    status = data.status;

    if (status === "succeeded") {
      // Replicate outputs differ by model. 
      // Flux returns ["url"]. Minimax returns "url" or ["url"]
      if (Array.isArray(data.output)) return data.output[0];
      return data.output as string;
    }

    if (status === "failed") {
      throw new Error(data.error || "Generation failed on Replicate side");
    }
  }
  return "";
};

export const generateFluxImage = async (prompt: string, aspectRatio: string = "9:16"): Promise<string> => {
  const token = getStoredReplicateKey();
  if (!token) throw new Error("Missing Replicate API Key");

  // Create Prediction
  const response = await fetch(`${REPLICATE_API_URL}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "f2537e90956896263884c6224395d886989467646549a1599320625377543883", // Flux Schnell
      input: {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        output_format: "jpg",
        safety_tolerance: 2 // Allow some creative freedom
      }
    })
  });

  if (!response.ok) {
     const err = await response.json();
     throw new Error(err.detail || "Failed to start Flux generation");
  }

  const prediction: ReplicateResponse = await response.json();
  return pollPrediction(prediction.urls.get, token);
};

export const generateMinimaxVideo = async (prompt: string): Promise<string> => {
  const token = getStoredReplicateKey();
  if (!token) throw new Error("Missing Replicate API Key");

  // Create Prediction for Video
  const response = await fetch(`${REPLICATE_API_URL}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_MINIMAX, 
      input: {
        prompt: prompt,
        // Minimax doesn't support aspect ratio params widely in all versions of the API yet via this endpoint structure,
        // often defaulting to 1280x720. We keep it simple here.
      }
    })
  });

  if (!response.ok) {
     const err = await response.json();
     throw new Error(err.detail || "Failed to start Video generation");
  }

  const prediction: ReplicateResponse = await response.json();
  return pollPrediction(prediction.urls.get, token);
};
