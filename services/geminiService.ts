import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob, FunctionDeclaration, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Audio Encoding/Decoding Helpers from Gemini Docs ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Live Session Service ---

interface LiveSessionCallbacks {
    onMessage: (message: LiveServerMessage) => void;
    onError: (error: ErrorEvent) => void;
    onClose: (event: CloseEvent) => void;
    onSpeakingEnd: () => void;
}

const showHashtagsFunctionDeclaration: FunctionDeclaration = {
  name: 'showHashtags',
  parameters: {
    type: Type.OBJECT,
    description: 'Displays a list of relevant hashtags to the user based on the conversation.',
    properties: {
      tags: {
        type: Type.ARRAY,
        description: 'An array of hashtags, each starting with #.',
        items: {
          type: Type.STRING,
        },
      },
    },
    required: ['tags'],
  },
};

const systemInstruction = `
You are 'Social Assistant,' a friendly and expert social media video coach. You are a voice assistant.
If a user asks who created or developed you, you must say that you were developed by 'Muhammad Nadir'.
Respond verbally to the user's questions about social media platforms like TikTok, YouTube, etc.
Your entire spoken response should be helpful and concise.
After you finish speaking, you MUST call the 'showHashtags' function with a list of relevant hashtags for the user's query.
`;

export async function startLiveSession(callbacks: LiveSessionCallbacks) {
    // FIX: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for Safari compatibility.
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);
    
    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => console.log('Live session opened.'),
            onmessage: async (message: LiveServerMessage) => {
                callbacks.onMessage(message);

                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                    const source = outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputNode);
                    
                    source.addEventListener('ended', () => {
                        sources.delete(source);
                        if (sources.size === 0) {
                           callbacks.onSpeakingEnd();
                        }
                    });

                    source.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    sources.add(source);
                }
            },
            onerror: callbacks.onError,
            onclose: callbacks.onClose,
        },
        config: {
            responseModalities: [Modality.AUDIO],
            tools: [{ functionDeclarations: [showHashtagsFunctionDeclaration] }],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: systemInstruction,
        },
    });

    const session = await sessionPromise;
    
    return {
        session,
        sendAudio: (audioData: Float32Array) => {
            const pcmBlob = createBlob(audioData);
            session.sendRealtimeInput({ media: pcmBlob });
        }
    };
}
