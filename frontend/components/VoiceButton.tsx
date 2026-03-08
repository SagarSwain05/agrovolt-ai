'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X, MessageCircle, Send } from 'lucide-react';

export default function VoiceButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const recognitionRef = useRef<any>(null);

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            setResponse('Voice recognition is not supported in this browser. Please try Chrome.');
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
            const current = event.results[event.results.length - 1];
            setTranscript(current[0].transcript);

            if (current.isFinal) {
                processCommand(current[0].transcript);
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        setResponse('');
    };

    const stopListening = () => {
        recognitionRef.current?.stop();
        setIsListening(false);
    };

    const processCommand = (command: string) => {
        const lower = command.toLowerCase();
        if (lower.includes('weather') || lower.includes('mausam')) {
            setResponse('The weather today is partly cloudy, 28°C with 65% humidity. No rain expected. Good conditions for solar panel output — estimated 87% efficiency.');
        } else if (lower.includes('crop') || lower.includes('fasal')) {
            setResponse('Based on your soil type (loamy) and current season, I recommend Ginger with a 92% success rate. Estimated yield: 15 quintals per acre under your current panel shade coverage of 40%.');
        } else if (lower.includes('price') || lower.includes('mandi') || lower.includes('market')) {
            setResponse('Tomato prices at Khordha Mandi: ₹2,650/quintal (up 5.2%). My analysis suggests waiting 3 days — prices projected to rise by ₹200/quintal based on supply patterns.');
        } else if (lower.includes('solar') || lower.includes('panel')) {
            setResponse('Your panels are at 87% efficiency. Current tilt is 35° — adjusting to 28° would give an estimated +8% efficiency gain. Bio-cooling from crops is reducing panel temperature by 3°C.');
        } else if (lower.includes('subsidy') || lower.includes('kusum')) {
            setResponse('You are eligible for PM-KUSUM Component B — up to 60% subsidy on a 5HP solar pump. Estimated subsidy value: ₹72,000. I can help you apply now.');
        } else {
            setResponse(`I understood: "${command}". I can help you with weather updates, crop recommendations, market prices, solar status, and subsidy information. Try asking about any of these.`);
        }
    };

    const quickCommands = [
        { label: 'Weather', cmd: 'What is the weather today?' },
        { label: 'Crop advice', cmd: 'Recommend a crop for me' },
        { label: 'Market price', cmd: 'What are today mandi prices?' },
        { label: 'Solar status', cmd: 'How are my panels performing?' },
    ];

    return (
        <>
            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    bottom: '1.5rem',
                    right: '1.5rem',
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-green-600), var(--color-green-700))',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 4px 16px rgba(5, 150, 105, 0.4)',
                    zIndex: 100,
                    transition: 'all 0.3s ease',
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                }}
            >
                {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
            </button>

            {/* Panel */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '5rem',
                        right: '1.5rem',
                        width: '340px',
                        maxHeight: '480px',
                        borderRadius: 'var(--radius-2xl)',
                        background: 'white',
                        boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--color-gray-200)',
                        zIndex: 99,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        animation: 'scaleIn 0.2s ease forwards',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '1rem 1.25rem',
                        background: 'linear-gradient(135deg, var(--color-green-700), var(--color-green-800))',
                        color: 'white',
                    }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.125rem' }}>
                            Sahayak AI
                        </div>
                        <div style={{ fontSize: '0.6875rem', opacity: 0.7, fontFamily: 'var(--font-body)' }}>
                            Voice-first farm intelligence assistant
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                        {response && (
                            <div style={{
                                padding: '0.875rem',
                                background: 'var(--color-green-50)',
                                borderRadius: 'var(--radius-lg)',
                                fontSize: '0.8125rem',
                                color: 'var(--color-gray-700)',
                                lineHeight: 1.65,
                                borderLeft: '3px solid var(--color-green-500)',
                                marginBottom: '0.75rem',
                                fontFamily: 'var(--font-body)',
                            }}>
                                {response}
                            </div>
                        )}

                        {transcript && (
                            <div style={{
                                padding: '0.625rem',
                                background: 'var(--color-gray-50)',
                                borderRadius: 'var(--radius-lg)',
                                fontSize: '0.8125rem',
                                color: 'var(--color-gray-600)',
                                fontStyle: 'italic',
                                marginBottom: '0.75rem',
                            }}>
                                &ldquo;{transcript}&rdquo;
                            </div>
                        )}

                        {/* Quick Commands */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                            {quickCommands.map((qc) => (
                                <button
                                    key={qc.label}
                                    onClick={() => {
                                        setTranscript(qc.cmd);
                                        processCommand(qc.cmd);
                                    }}
                                    style={{
                                        padding: '0.375rem 0.75rem',
                                        borderRadius: 'var(--radius-full)',
                                        border: '1px solid var(--color-gray-200)',
                                        background: 'white',
                                        fontSize: '0.6875rem',
                                        fontWeight: 500,
                                        color: 'var(--color-gray-600)',
                                        cursor: 'pointer',
                                        fontFamily: 'var(--font-body)',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {qc.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mic Button */}
                    <div style={{
                        padding: '0.75rem 1rem',
                        borderTop: '1px solid var(--color-gray-100)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                    }}>
                        <button
                            onClick={isListening ? stopListening : startListening}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: isListening ? 'var(--color-red-500)' : 'var(--color-green-600)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                flexShrink: 0,
                                boxShadow: isListening ? '0 0 0 4px rgba(239,68,68,0.2)' : 'none',
                                animation: isListening ? 'pulse-ring 1.5s ease infinite' : 'none',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', fontFamily: 'var(--font-body)' }}>
                            {isListening ? 'Listening... tap to stop' : 'Tap mic to speak in English, Hindi, or Odia'}
                        </span>
                    </div>
                </div>
            )}
        </>
    );
}
