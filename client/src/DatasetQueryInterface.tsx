import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { 
  Send, 
  Database, 
  MessageCircle,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  CheckCircle,
  Loader,
  Mic,
  Home
} from 'lucide-react';
import ExcelProcessor from './excelProcessor';
import type { ExcelData } from './excelProcessor';

const API_KEY = "AIzaSyBb8wn7BpyPFgDKgk2NLXxmO-PMJDZ3ri0";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const DatasetQueryInterface: React.FC = () => {
  // State management
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [query, setQuery] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  
  // Refs
  const queryRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Load Excel file on component mount
  useEffect(() => {
    loadDefaultExcelFile();
  }, []);

  const loadDefaultExcelFile = async () => {
    try {
      setIsLoadingData(true);
      const response = await fetch('/DataSet_Hackathon.xlsx');
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], 'DataSet_Hackathon.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const processedData = await excelProcessor.processExcelFile(file);
        setExcelData(processedData);
        
        // Add welcome message
        const welcomeMessage: ChatMessage = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `🎉 **Dataset loaded successfully!**\n\nI have access to your Excel file with **${processedData.sheets.length} sheets** containing **${processedData.sheets.reduce((acc: number, sheet: any) => acc + sheet.rowCount, 0)} total rows** of data.\n\n✨ **You can now ask me anything about your data!** Just type your question below and I'll analyze the entire dataset to give you insights.\n\n**Example queries:**\n- "What are the key trends in this data?"\n- "Show me the top performers"\n- "What insights can you find?"\n- "Summarize the main metrics"`,
          timestamp: new Date()
        };
        
        setChatHistory([welcomeMessage]);
      } else {
        throw new Error('Could not load Excel file');
      }
    } catch (error) {
      console.error('Error loading Excel file:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `❌ **Could not load the Excel file automatically.**\n\nPlease make sure the DataSet_Hackathon.xlsx file is in the public folder, or you can upload your own Excel file by refreshing and using the file upload feature.`,
        timestamp: new Date()
      };
      setChatHistory([errorMessage]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const generateAIPrompt = (userQuery: string): string => {
    if (!excelData) return userQuery;

    const dataContext = excelProcessor.formatDataForAI();

    return `You are an expert data analyst with access to a comprehensive Excel dataset. Here's the complete data structure and content:

${dataContext}

IMPORTANT INSTRUCTIONS:
- You have full access to ALL sheets and ALL data in this Excel file
- Analyze the ENTIRE dataset to answer the user's question
- Provide specific insights, numbers, trends, and patterns
- Be comprehensive and detailed in your analysis
- Use the actual data values and structure shown above
- If the user asks about trends, patterns, or insights, examine all relevant data points
- Present findings in a clear, structured format with bullet points and sections
- Include relevant statistics, comparisons, and recommendations when applicable

User Question: ${userQuery}

Please provide a thorough analysis based on the complete dataset above.`;
  };

  const handleSubmitQuery = async () => {
    if (!query.trim() || !excelData) return;

    setIsLoading(true);
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMessage]);

    try {
      const aiPrompt = generateAIPrompt(query);
      
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: aiPrompt }]
        }],
        safetySettings
      });

      const response = await result.response;
      const aiResponse = response.text();

      // Add AI response to chat
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error querying AI:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `❌ **Error processing your query**\n\nSorry, I encountered an error while analyzing your data. Please try rephrasing your question or try again in a moment.`,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setQuery('');
      if (queryRef.current) {
        queryRef.current.focus();
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitQuery();
    }
  };

  const suggestedQueries = [
    "What are the key insights from this dataset?",
    "Show me the top performing items",
    "What trends do you see in the data?",
    "Summarize the main metrics and statistics",
    "Are there any interesting patterns or anomalies?"
  ];

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Dataset</h2>
          <p className="text-gray-600">Processing your Excel file...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
              <Home className="w-5 h-5" />
              <span>Home</span>
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-full">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-800">AI Dataset Query</h1>
            </div>
            
            <Link to="/voice-mode" className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              <Mic className="w-4 h-4" />
              <span>Voice Mode</span>
            </Link>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Ask me anything about your Excel dataset. I have complete access to all sheets and data.
          </p>
          
          {excelData && (
            <div className="mt-4 inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Dataset loaded: {excelData.sheets.length} sheets, {excelData.sheets.reduce((acc: number, sheet: any) => acc + sheet.rowCount, 0)} rows</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chat History - Left Side */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Query Results</h2>
                </div>
              </div>
              
              <div 
                ref={chatContainerRef}
                className="h-96 overflow-y-auto p-6 space-y-4"
              >
                {chatHistory.length > 0 ? (
                  chatHistory.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 ${
                          message.type === 'user'
                            ? 'bg-blue-600 text-white ml-4'
                            : 'bg-gray-100 text-gray-800 mr-4'
                        }`}
                      >
                        {message.type === 'assistant' ? (
                          <div className="prose prose-sm max-w-none">
                            <Markdown>{message.content}</Markdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                        <div className={`text-xs mt-2 ${message.type === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 mt-12">
                    <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">Ready to analyze your data!</p>
                    <p className="text-sm">Ask any question about your Excel dataset below.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Query Input and Suggestions - Right Side */}
          <div className="space-y-6">
            {/* Query Input Box */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">Ask Your Question</h3>
              </div>
              
              <div className="space-y-4">
                <textarea
                  ref={queryRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask anything about your Excel data..."
                  className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                  rows={4}
                  disabled={!excelData}
                />
                
                <button
                  onClick={handleSubmitQuery}
                  disabled={!query.trim() || isLoading || !excelData}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Ask AI
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Suggested Queries */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Suggested Questions</h3>
              <div className="space-y-2">
                {suggestedQueries.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(suggestion)}
                    className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors duration-200 border border-transparent hover:border-blue-200"
                    disabled={isLoading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Dataset Info */}
            {excelData && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Dataset Overview</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Sheets:</span>
                    <span className="font-semibold text-gray-800">{excelData.sheets.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Rows:</span>
                    <span className="font-semibold text-gray-800">
                      {excelData.sheets.reduce((acc: number, sheet: any) => acc + sheet.rowCount, 0)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-gray-600 text-xs">
                      AI has access to all sheets and data for comprehensive analysis.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatasetQueryInterface;