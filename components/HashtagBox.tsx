import React from 'react';

interface HashtagBoxProps {
    hashtags: string[];
}

export const HashtagBox: React.FC<HashtagBoxProps> = ({ hashtags }) => {
    return (
        <div className="w-full max-w-md bg-white/30 backdrop-blur-sm p-4 rounded-2xl">
            <div className="flex flex-wrap gap-2 justify-center">
                {hashtags.map((tag, index) => (
                    <span 
                        key={index} 
                        className="px-3 py-1.5 bg-gray-500/10 text-sky-700 rounded-lg text-sm font-medium ring-1 ring-inset ring-gray-500/20"
                    >
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
};
