"use client"

import { useState, useRef, type ChangeEvent, type KeyboardEvent, type JSX } from "react"
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai"
import Markdown from "react-markdown"
import { Paperclip, Send, X } from "lucide-react"

const API_KEY = "AIzaSyBb8wn7BpyPFgDKgk2NLXxmO-PMJDZ3ri0" // "API_KEY" or create .env and use accordingly

interface FileWithPreview extends File {
  preview?: string
}

function GeminiChat(): JSX.Element {
  const [inputText, setInputText] = useState<string>("")
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([])
  const [output, setOutput] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const genAI = new GoogleGenerativeAI(API_KEY)
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

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
  ]

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []) as FileWithPreview[]
    setSelectedFiles((prevFiles) => [...prevFiles, ...files])
  }

  const removeFile = (indexToRemove: number): void => {
    setSelectedFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove))
  }

  const handleSubmit = async (): Promise<void> => {
    if (!inputText.trim() && selectedFiles.length === 0) return

    setIsLoading(true)
    setOutput("Processing...")

    try {
      // Import Part type from @google/generative-ai
      // @ts-ignore-next-line
      import type { Part } from "@google/generative-ai";

      const parts: Part[] = []

      if (inputText.trim()) {
        parts.push({ text: inputText.trim() })
      }

      for (const file of selectedFiles) {
        const base64 = await fileToBase64(file)
        parts.push({
          inlineData: {
            data: base64,
            mimeType: file.type,
          },
        })
      }

      const request = {
        contents: [
          {
            role: "user",
            parts: parts,
          },
        ],
        safetySettings: safetySettings,
      }

      const result = await model.generateContent(request)

      const response = await result.response
      const text = response.text()
      console.log("Generated content:", text)
      setOutput(text)
    } catch (error: unknown) {
      console.error("Error generating content:", error)
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
      setOutput(`Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64String = reader.result.split(",")[1]
          resolve(base64String)
        } else {
          reject(new Error('Failed to read file as base64'))
        }
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const clearAll = (): void => {
    setInputText("")
    setSelectedFiles([])
    setOutput("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div>
      <h1>Gemini AI</h1>
      
      {/* Input Section */}
      <div>
        <textarea
          placeholder="Enter your text here..."
          value={inputText}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={4}
        />
        
        <div>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,audio/*,application/pdf,text/plain"
          />
          
          <button 
            onClick={handleSubmit} 
            disabled={isLoading || (!inputText.trim() && selectedFiles.length === 0)}
          >
            <Send size={16} />
            {isLoading ? "Processing..." : "Submit"}
          </button>
          
          <button onClick={clearAll}>
            Clear All
          </button>
        </div>

        {/* Selected Files Display */}
        {selectedFiles.length > 0 && (
          <div>
            <h3>Selected Files:</h3>
            {selectedFiles.map((file, index) => (
              <div key={index}>
                <Paperclip size={14} />
                <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                <button onClick={() => removeFile(index)}>
                  <X size={14} />
                  Remove
                </button>
                
                {/* Preview for images */}
                {file.type.startsWith("image/") && (
                  <div>
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      width="200"
                    />
                  </div>
                )}
                
                {/* Preview for audio */}
                {file.type.startsWith("audio/") && (
                  <div>
                    <audio controls src={URL.createObjectURL(file)}></audio>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <hr />

      {/* Output Section */}
      <div>
        <h2>Output:</h2>
        {output ? (
          <div>
            <Markdown>{output}</Markdown>
          </div>
        ) : (
          <p>No output yet. Enter text or upload files and click Submit.</p>
        )}
      </div>
    </div>
  )
}

export default GeminiChat