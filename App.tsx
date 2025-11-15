import React, { useState, useRef, useEffect } from 'react';
import { AIBall } from './components/AIBall';
import { HashtagBox } from './components/HashtagBox';
import { startLiveSession } from './services/geminiService';
import type { LiveSession } from '@google/genai';

const App: React.FC = () => {
    const [appState, setAppState] = useState<'idle' | 'listening' | 'speaking'>('idle');
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [copyButtonText, setCopyButtonText] = useState('Copy Hashtags');

    const sessionRef = useRef<LiveSession | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const stopAudioPlayback = () => {
        audioSourcesRef.current.forEach(source => {
            source.stop();
        });
        audioSourcesRef.current.clear();
    };

    const cleanup = () => {
        stopAudioPlayback();
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }

        sessionRef.current = null;
        audioContextRef.current = null;
        mediaStreamRef.current = null;
        setAppState('idle');
    };

    const handleToggleSession = async () => {
        if (sessionRef.current) {
            sessionRef.current.close();
            // Cleanup is handled by the onclose event
            return;
        }

        try {
            setAppState('listening');
            setError(null);
            setHashtags([]); // Clear hashtags on new session

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = context;

            const source = context.createMediaStreamSource(stream);
            const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

            const liveSession = await startLiveSession({
                onMessage: async (message) => {
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            if (fc.name === 'showHashtags' && fc.args.tags && Array.isArray(fc.args.tags)) {
                                const newHashtags = fc.args.tags.map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`);
                                if (newHashtags.length > 0) {
                                    setHashtags(prev => [...new Set([...prev, ...newHashtags])]);
                                }

                                sessionRef.current?.sendToolResponse({
                                    functionResponses: {
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "ok, hashtags displayed" },
                                    }
                                });
                            }
                        }
                    }

                    if (message.serverContent?.interrupted) {
                        stopAudioPlayback();
                    }
                    
                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData) {
                        if (appState !== 'speaking') {
                            setAppState('speaking');
                        }
                    }
                },
                onClose: () => {
                    cleanup();
                },
                onError: (e) => {
                    console.error('Session error:', e);
                    setError('An error occurred during the session. Please try again.');
                    cleanup();
                },
                onSpeakingEnd: () => {
                   setAppState('listening');
                }
            });

            sessionRef.current = liveSession.session;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                liveSession.sendAudio(inputData);
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(context.destination);

        } catch (e) {
            console.error('Failed to start session', e);
            setError('Could not start session. Please check microphone permissions.');
            cleanup();
        }
    };
    
    const handleCopy = () => {
        if (hashtags.length === 0) return;
        const hashtagString = hashtags.join(' ');
        navigator.clipboard.writeText(hashtagString).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy Hashtags'), 2000);
        });
    };

    useEffect(() => {
        return () => {
            sessionRef.current?.close();
            cleanup();
        };
    }, []);

    const getPlaceholderText = () => {
        switch (appState) {
            case 'listening':
                return 'Listening...';
            case 'speaking':
                return 'Speaking...';
            default:
                return 'Tap the AI Ball for creator tips!';
        }
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-200 flex flex-col items-center justify-between p-4 font-sans text-gray-800 overflow-hidden">
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
                .flex-center { display: flex; align-items: center; justify-content: center; }
            `}</style>
            
            {/* Top Spacer */}
            <div className="w-full max-w-sm flex-shrink-0 h-24"></div>

            {/* Middle Content */}
            <div className="flex flex-col items-center justify-center flex-shrink-0">
                 <div className="my-6 md:my-8">
                    <AIBall state={appState} onClick={handleToggleSession} />
                </div>
                <div className="w-full max-w-sm bg-white/50 backdrop-blur-lg rounded-2xl p-4 text-center text-gray-600 shadow-md">
                    {getPlaceholderText()}
                </div>
            </div>
            
            {/* Bottom Content */}
            <div className="w-full max-w-sm flex-grow flex flex-col items-center justify-end pb-4">
                {hashtags.length > 0 && (
                    <div className="w-full flex flex-col items-center animate-fade-in-up">
                        <HashtagBox hashtags={hashtags} />
                        <button 
                            onClick={handleCopy}
                            className="w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-shadow duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300"
                        >
                            {copyButtonText}
                        </button>
                    </div>
                )}
                 {error && (
                     <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl w-full animate-fade-in-up" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span>{error}</span>
                    </div>
                )}
                 {hashtags.length === 0 && !error && <div className="h-[120px]"></div>}
            </div>
        </div>
    );
};

export default App;
