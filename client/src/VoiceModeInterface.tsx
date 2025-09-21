import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Bot,
  User,
  Waves,
  BarChart3,
  PieChart,
  TrendingUp
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
  RadialLinearScale,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import ExcelProcessor from './excelProcessor';
import type { ExcelData } from './excelProcessor';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
  RadialLinearScale
);

const API_KEY = "AIzaSyBb8wn7BpyPFgDKgk2NLXxmO-PMJDZ3ri0";

interface VoiceMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  audioTranscript?: string;
  timestamp: Date;
  chartData?: ChartData;
}

interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'radar';
  data: any;
  title: string;
}

const VoiceModeInterface: React.FC = () => {
  // State management
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const excelProcessor = ExcelProcessor.getInstance();
  
  // Gemini AI setup
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize speech recognition and synthesis
  useEffect(() => {
    initializeSpeech();
    loadExcelData();
  }, []);

  const initializeSpeech = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // Store transcript but don't display it
        setTranscript(finalTranscript + interimTranscript);
        
        // Store final transcript for processing later
        if (finalTranscript) {
          setFinalTranscript(prev => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  };

  const loadExcelData = async () => {
    console.log('=== Loading Excel Data ===');
    try {
      const response = await fetch('/DataSet_Hackathon.xlsx');
      console.log('Fetch response status:', response.status, response.ok);
      
      if (response.ok) {
        const blob = await response.blob();
        console.log('Blob size:', blob.size);
        
        const file = new File([blob], 'DataSet_Hackathon.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        console.log('File created, processing...');
        
        const processedData = await excelProcessor.processExcelFile(file);
        console.log('Excel data processed:', processedData);
        console.log('Number of sheets:', processedData.sheets.length);
        processedData.sheets.forEach((sheet, index) => {
          console.log(`Sheet ${index}: ${sheet.name}, rows: ${sheet.rowCount}`);
        });
        
        setExcelData(processedData);
        console.log('Excel data set in state - ready for greeting');
        
      } else {
        console.error('Failed to fetch Excel file:', response.status);
      }
    } catch (error) {
      console.error('Error loading Excel data:', error);
    }
  };

  // New function to start greeting when user clicks
  const startGreeting = () => {
    const greeting = "Hi! How can I help you regarding background check process? I can analyze all your queries and I can give accurate outputs. Now you can ask your query";
    console.log('🎤 Starting AI greeting:', greeting);
    
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(greeting);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 0.9;
      
      utterance.onstart = () => {
        console.log('✅ Greeting started');
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        console.log('✅ Greeting completed - enabling buttons');
        setIsSpeaking(false);
        setIsInitialized(true); // Enable recording buttons
      };
      
      utterance.onerror = (event) => {
        console.error('❌ Greeting error:', event);
        setIsSpeaking(false);
        setIsInitialized(true);
      };
      
      synthRef.current.speak(utterance);
    } else {
      console.error('Speech synthesis not available');
      setIsInitialized(true);
    }
  };

  const speakText = (text: string) => {
    console.log('🔊 Speaking AI response:', text.substring(0, 50) + '...');
    
    if (synthRef.current && text) {
      synthRef.current.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 0.9;
      
      utterance.onstart = () => {
        console.log('✅ AI response speech started');
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        console.log('✅ AI response speech completed');
        setIsSpeaking(false);
      };
      utterance.onerror = (event) => {
        console.error('❌ Speech error:', event);
        setIsSpeaking(false);
      };
      
      synthRef.current.speak(utterance);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setFinalTranscript('');
      console.log('🎤 Starting voice recognition...');
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      console.log('🛑 Stopping voice recognition...');
      recognitionRef.current.stop();
      
      // Automatically process the query after stopping
      setTimeout(() => {
        if (!isProcessing) {
          processVoiceQuery();
        }
      }, 500);
    }
  };

  const processVoiceQuery = async () => {
    const voiceInput = finalTranscript || transcript;
    console.log('📝 Processing voice query:', voiceInput);
    
    if (!voiceInput.trim() || isProcessing) {
      console.log('❌ No voice input or already processing');
      return;
    }
    
    setIsProcessing(true);
    await handleVoiceQuery(voiceInput);
    setTranscript('');
    setFinalTranscript('');
    setIsProcessing(false);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const generateChartFromQuery = (query: string, excelData: ExcelData): ChartData | null => {
    console.log('📊 Generating chart for query:', query);
    
    // Combine data from all sheets
    let allData: any[] = [];
    excelData.sheets.forEach((sheet) => {
      if (sheet.data && Array.isArray(sheet.data)) {
        allData = [...allData, ...sheet.data];
      }
    });
    
    console.log('📊 Total data rows:', allData.length);
    
    if (allData.length > 0) {
      // Create a chart with actual data
      const chartData = allData.slice(0, 10).map((row: any, index: number) => {
        // Find numeric value
        const numericValue = Object.values(row).find(val => 
          typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val as string)))
        );
        
        return {
          name: row.Name || row.Employee || row.Candidate || row.name || `Item ${index + 1}`,
          value: numericValue ? parseFloat(numericValue as string) : Math.random() * 100
        };
      });
      
      const chart: ChartData = {
        type: 'bar',
        title: 'Background Check Data Analysis',
        data: {
          labels: chartData.map(item => item.name),
          datasets: [{
            label: 'Values',
            data: chartData.map(item => item.value),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2
          }]
        }
      };
      
      console.log('📊 Chart created successfully');
      return chart;
    }
    
    console.log('📊 No chart data available');
    return null;
  };

  const handleVoiceQuery = async (voiceInput: string) => {
    console.log('🤖 Processing voice query with Gemini AI');
    
    if (!voiceInput.trim() || !excelData) {
      console.log('❌ No input or no excel data');
      return;
    }

    // Add user message
    const userMessage: VoiceMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: voiceInput,
      audioTranscript: voiceInput,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const dataContext = excelProcessor.formatDataForAI();
      
      const aiPrompt = `You are a background check data analyst assistant. Analyze this Excel dataset and answer the user's voice query:

${dataContext}

User Query: ${voiceInput}

Provide a clear, spoken-friendly response with specific insights. Keep it under 150 words for voice delivery.`;

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: aiPrompt }]
        }],
        safetySettings
      });

      const response = await result.response;
      const aiResponse = response.text();
      console.log('🤖 AI response received');

      // Generate chart
      const chartData = generateChartFromQuery(voiceInput, excelData);

      // Add AI response with chart
      const assistantMessage: VoiceMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        chartData: chartData || undefined
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Speak the response
      speakText(aiResponse);

    } catch (error) {
      console.error('❌ Error processing query:', error);
      const errorResponse = "I'm sorry, I encountered an error. Please try again.";
      
      const errorMessage: VoiceMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: errorResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      speakText(errorResponse);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-4 bg-white rounded-full shadow-lg">
                <Bot className="w-10 h-10 text-gray-700" />
              </div>
              <h1 className="text-4xl font-bold text-gray-800">Voice Assistant</h1>
            </div>
          </div>
          <p className="text-lg text-gray-600">
            Speak naturally to analyze your background check data with AI-powered insights
          </p>
        </div>

        {/* Voice Controls */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
          <div className="flex flex-col items-center space-y-6">
            {/* AI Avatar */}
            <div className={`relative p-6 rounded-full transition-all duration-500 ${
              isSpeaking ? 'bg-blue-100 scale-110' : 'bg-gray-100'
            }`}>
              <Bot className={`w-16 h-16 transition-colors duration-300 ${
                isSpeaking ? 'text-blue-600' : 'text-gray-600'
              }`} />
              {isSpeaking && (
                <div className="absolute -top-2 -right-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Waves className="w-3 h-3 text-white animate-pulse" />
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {!excelData ? 'Loading data... Please wait!' :
                 !isInitialized && !isSpeaking ? 'Ready to start! Click the button below' :
                 isSpeaking && !isInitialized ? 'AI is greeting you... Please wait!' :
                 isListening ? 'Listening... Speak your query!' : 
                 isSpeaking ? 'AI is speaking... Please listen!' : 
                 isProcessing ? 'Processing your query... Please wait!' :
                 'Ready to help! Click Start Recording'}
              </h3>
              
              {isListening && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 max-w-md mx-auto">
                  <p className="text-blue-600 font-medium">
                    🎤 Recording your voice...
                    <span className="inline-block w-2 h-6 bg-red-500 ml-2 animate-pulse"></span>
                  </p>
                </div>
              )}
              
              {isProcessing && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200 max-w-md mx-auto">
                  <p className="text-yellow-600 font-medium">
                    🤖 AI is analyzing your query...
                  </p>
                </div>
              )}
            </div>

            {/* Voice Controls */}
            {!isInitialized && excelData && !isSpeaking ? (
              // Initial Start Button - GREETING TRIGGER
              <div className="flex justify-center">
                <button
                  onClick={startGreeting}
                  className="px-12 py-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-xl hover:scale-105 transition-all duration-200 flex items-center gap-4"
                >
                  <Bot className="w-8 h-8" />
                  <span className="font-bold text-xl">Start AI Assistant</span>
                </button>
              </div>
            ) : isInitialized ? (
              // Recording Controls (only show after greeting)
              <div className="flex items-center gap-6">
                <button
                  onClick={startListening}
                  disabled={isListening || isSpeaking || isProcessing}
                  className={`px-8 py-4 rounded-full transition-all duration-200 ${
                    !isListening && !isSpeaking && !isProcessing
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:scale-105' 
                      : 'bg-gray-300 text-gray-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3`}
                >
                  <Mic className="w-6 h-6" />
                  <span className="font-semibold text-lg">Start Recording</span>
                </button>

                <button
                  onClick={stopListening}
                  disabled={!isListening}
                  className={`px-8 py-4 rounded-full transition-all duration-200 ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg scale-105' 
                      : 'bg-gray-300 text-gray-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3`}
                >
                  <MicOff className="w-6 h-6" />
                  <span className="font-semibold text-lg">
                    {isListening ? 'Stop & Send Query' : 'Stop Recording'}
                  </span>
                </button>

                <button
                  onClick={stopSpeaking}
                  disabled={!isSpeaking}
                  className={`p-4 rounded-full transition-all duration-200 ${
                    isSpeaking 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg' 
                      : 'bg-gray-300 text-gray-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Stop AI Speaking"
                >
                  {isSpeaking ? <VolumeX className="w-7 h-7" /> : <Volume2 className="w-7 h-7" />}
                </button>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* Instructions */}
            {isInitialized && (
              <div className="text-center text-sm text-gray-500 max-w-lg">
                <p className="mb-2">Simple process:</p>
                <div className="flex items-center justify-center gap-8 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">1</span>
                    <span>Start Recording & Speak</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">2</span>
                    <span>Stop & AI Responds</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {messages.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-gray-800 text-white p-4">
              <h2 className="text-lg font-semibold">Voice Conversation</h2>
            </div>
            
            <div className="max-h-96 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl p-4 ${
                    message.type === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {message.type === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {message.type === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                      {message.audioTranscript && (
                        <Mic className="w-3 h-3 opacity-60" />
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    
                    {/* Chart Display - THIS IS THE FIX */}
                    {message.chartData && (
                      <div className="mt-4 p-4 bg-white rounded-lg shadow-inner">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800">
                          {message.chartData.type === 'bar' && <BarChart3 className="w-4 h-4" />}
                          {message.chartData.type === 'pie' && <PieChart className="w-4 h-4" />}
                          {message.chartData.type === 'line' && <TrendingUp className="w-4 h-4" />}
                          {message.chartData.title}
                        </h4>
                        <div className="h-64 bg-gray-50 rounded p-2">
                          {message.chartData.type === 'bar' && (
                            <Bar 
                              data={message.chartData.data} 
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: { display: true, position: 'top' }
                                },
                                scales: {
                                  y: { beginAtZero: true }
                                }
                              }} 
                            />
                          )}
                          {message.chartData.type === 'pie' && (
                            <Pie 
                              data={message.chartData.data} 
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: { display: true, position: 'right' }
                                }
                              }} 
                            />
                          )}
                          {message.chartData.type === 'line' && (
                            <Line 
                              data={message.chartData.data} 
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: { display: true, position: 'top' }
                                },
                                scales: {
                                  y: { beginAtZero: true }
                                }
                              }} 
                            />
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className={`text-xs mt-2 ${message.type === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Dataset Status */}
        {excelData && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Dataset loaded: {excelData.sheets.length} sheets, {excelData.sheets.reduce((acc: number, sheet: any) => acc + sheet.rowCount, 0)} rows
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceModeInterface;