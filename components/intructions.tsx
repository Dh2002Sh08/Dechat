'use client';

import React, { useEffect, useRef } from 'react';



const Instructions: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    const createSparkle = (x: number, y: number) => {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.left = `${x}px`;
        sparkle.style.top = `${y}px`;
        document.body.appendChild(sparkle);

        setTimeout(() => {
            sparkle.remove();
        }, 1200); // Sparkle lifetime extended
    };

    const handleMouseMove = (e: MouseEvent) => {
        createSparkle(e.clientX, e.clientY);
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div
            ref={containerRef}
            className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
        >
            <style>{`
            .sparkle {
              position: fixed;
              width: 8px;
              height: 8px;
              background: radial-gradient(circle, #8ab4f8, #ffffff);
              border-radius: 50%;
              pointer-events: none;
              opacity: 0.8;
              z-index: 9999;
              animation: sparkle-fade 1.2s ease-out forwards;
            }
    
            @keyframes sparkle-fade {
              0% {
                transform: scale(1.8);
                opacity: 1;
                filter: drop-shadow(0 0 6px #8ab4f8);
              }
              50% {
                opacity: 0.8;
              }
              100% {
                transform: scale(0.4);
                opacity: 0;
                filter: none;
              }
            }
          `}</style>

            <div className="max-w-4xl w-full bg-white border border-gray-200 rounded-xl shadow-md p-8 relative z-10">
                <h1 className="text-4xl md:text-5xl font-bold text-center text-gray-800 mb-6 font-orbitron">
                    Welcome to DeChat
                </h1>
                <p className="text-center text-gray-600 text-lg mb-10 font-roboto-mono">
                    Start chatting securely on the Solana blockchain. Follow these steps to get started.
                </p>

                <div className="space-y-6">
                    <div className="border border-gray-100 rounded-lg p-5 hover:shadow-md transition duration-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">1. Initialize Profile</h2>
                        <p className="text-gray-600">
                            Create your blockchain profile by clicking
                            <span className="font-bold text-blue-600"> Create Profile</span>.
                        </p>
                    </div>

                    <div className="border border-gray-100 rounded-lg p-5 hover:shadow-md transition duration-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">2. Add Wallet</h2>
                        <p className="text-gray-600">
                            Add your friend’s wallet in the
                            <span className="font-bold text-purple-600"> Add Wallet</span> section.
                        </p>
                    </div>

                    <div className="border border-gray-100 rounded-lg p-5 hover:shadow-md transition duration-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">3. Start Chat</h2>
                        <p className="text-gray-600">
                            Click
                            <span className="font-bold text-green-600"> Start Chat</span> to open a secure channel.
                        </p>
                    </div>

                    <div className="border border-gray-100 rounded-lg p-5 hover:shadow-md transition duration-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">4. Chat Freely</h2>
                        <p className="text-gray-600">
                            You’re all set!
                            <span className="font-bold text-yellow-600"> Start chatting 🎉</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Instructions;