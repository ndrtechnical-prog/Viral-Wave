import React from 'react';

interface AIBallProps {
    state: 'idle' | 'listening' | 'speaking';
    onClick: () => void;
}

export const AIBall: React.FC<AIBallProps> = ({ state, onClick }) => {
    const ballSize = "w-40 h-40 sm:w-48 sm:h-48";

    const getStateClasses = () => {
        switch (state) {
            case 'listening':
                return 'listening-glow';
            case 'speaking':
                return 'speaking-glow';
            default:
                return 'idle-glow';
        }
    };

    return (
        <div className="relative flex items-center justify-center">
             <style>{`
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(1); opacity: 0.7; }
                    50% { transform: scale(1.05); opacity: 1; }
                }
                @keyframes pulse-strong {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.1); opacity: 1; }
                }
                @keyframes aurora {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .glow-container {
                    content: '';
                    position: absolute;
                    inset: -25px;
                    border-radius: 50%;
                    filter: blur(40px);
                    transition: transform 0.5s ease-in-out, opacity 0.5s ease-in-out;
                    z-index: -1;
                }
                .idle-glow .glow-container {
                    background: radial-gradient(circle, #f87171, #60a5fa, #c084fc);
                    animation: pulse-slow 5s ease-in-out infinite;
                }
                .listening-glow .glow-container {
                    background: radial-gradient(circle, #60a5fa, #c084fc, #f87171);
                    animation: pulse-strong 1.5s ease-in-out infinite;
                }
                .speaking-glow .glow-container {
                    background: linear-gradient(-45deg, #f87171, #60a5fa, #c084fc, #34d399);
                    background-size: 300% 300%;
                    animation: aurora 8s ease infinite;
                    transform: scale(1.1);
                    opacity: 1;
                }
            `}</style>
            <div className={`relative ${ballSize} ${getStateClasses()}`}>
                <div className="glow-container"></div>
                <button
                    onClick={onClick}
                    className={`relative w-full h-full rounded-full transition-transform duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-purple-300/50 active:scale-95`}
                    style={{
                        background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(230,235,255,0.8) 100%)',
                        boxShadow: '0px 10px 30px -10px rgba(0, 0, 0, 0.1), inset 0px 4px 10px rgba(255, 255, 255, 0.7)',
                    }}
                    aria-label={state === 'idle' ? 'Start session' : 'Stop session'}
                >
                    {/* Inner glassy effect */}
                    <div className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-[1px]"></div>
                </button>
            </div>
        </div>
    );
};
