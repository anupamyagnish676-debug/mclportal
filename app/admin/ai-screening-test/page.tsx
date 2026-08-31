'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

export default function AIScreeningTestPage() {
  const [isAiLoaded, setIsAiLoaded] = useState(false);
  const [status, setStatus] = useState('Loading AI Engine...');
  
  const [aadharImage, setAadharImage] = useState<string | null>(null);
  const [passportImage, setPassportImage] = useState<string | null>(null);
  
  const aadharImgRef = useRef<HTMLImageElement>(null);
  const passportImgRef = useRef<HTMLImageElement>(null);

  // We load faceapi dynamically inside useEffect to avoid Next.js server-side rendering issues
  const faceapiRef = useRef<any>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        const faceapi = await import('face-api.js');
        faceapiRef.current = faceapi;
        
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        
        setIsAiLoaded(true);
        setStatus('Ready! Upload photos to test.');
      } catch (err) {
        console.error('Failed to load AI Models:', err);
        setStatus('Error: Failed to load AI models. Ensure they exist in public/models.');
      }
    }
    loadModels();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setter(event.target?.result as string);
      reader.readAsDataURL(file);
      // Reset status if they change a photo
      if (isAiLoaded) setStatus('Ready to analyze...');
    }
  };

  const runScreening = async () => {
    if (!isAiLoaded || !aadharImgRef.current || !passportImgRef.current) return;
    const faceapi = faceapiRef.current;
    
    setStatus('Analyzing faces... This may take a moment.');
    
    try {
      // Extract face data from Aadhar image
      const aadharFace = await faceapi.detectSingleFace(aadharImgRef.current)
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();
                                      
      if (!aadharFace) {
        setStatus('❌ Error: Could not detect a clear face in the Aadhar photo.');
        return;
      }

      // Extract face data from Passport image
      const passportFace = await faceapi.detectSingleFace(passportImgRef.current)
                                        .withFaceLandmarks()
                                        .withFaceDescriptor();

      if (!passportFace) {
        setStatus('❌ Error: Could not detect a clear face in the Passport photo.');
        return;
      }

      // Calculate distance between the two faces (Lower is better)
      const distance = faceapi.euclideanDistance(aadharFace.descriptor, passportFace.descriptor);
      
      // Calculate a confidence percentage (rough mapping from distance)
      const confidence = Math.max(0, Math.round((1 - distance) * 100));

      if (distance < 0.45) {
        setStatus(`✅ 100% MATCH: Same Person Confirmed! (Distance: ${distance.toFixed(2)}, Confidence: ${confidence}%)`);
      } else if (distance < 0.6) {
        setStatus(`✅ GOOD MATCH: Likely the same person. (Distance: ${distance.toFixed(2)}, Confidence: ${confidence}%)`);
      } else {
        setStatus(`❌ WARNING: Faces DO NOT MATCH! (Distance: ${distance.toFixed(2)}, Confidence: ${confidence}%)`);
      }

    } catch (err) {
      console.error(err);
      setStatus('❌ AI Screening Failed due to an unexpected error.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">🤖</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI KYC Identity Screening</h1>
            <p className="text-gray-500">Test the local facial recognition engine. No data leaves this computer.</p>
          </div>
        </div>

        {/* Status Bar */}
        <div className={`p-4 rounded-xl font-medium mb-8 ${status.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : status.includes('❌') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
          {status}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Aadhar Upload */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">1. Aadhar Card Photo</h3>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => handleImageUpload(e, setAadharImage)} 
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {aadharImage && (
              <div className="relative h-64 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                <img 
                  ref={aadharImgRef}
                  src={aadharImage} 
                  alt="Aadhar" 
                  className="object-contain w-full h-full"
                  crossOrigin="anonymous" 
                />
              </div>
            )}
          </div>

          {/* Passport Upload */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">2. Passport Size Photo</h3>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => handleImageUpload(e, setPassportImage)} 
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {passportImage && (
              <div className="relative h-64 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                <img 
                  ref={passportImgRef}
                  src={passportImage} 
                  alt="Passport" 
                  className="object-contain w-full h-full"
                  crossOrigin="anonymous" 
                />
              </div>
            )}
          </div>

        </div>

        {/* Action Button */}
        <div className="mt-8 flex justify-center">
          <button 
            onClick={runScreening}
            disabled={!isAiLoaded || !aadharImage || !passportImage}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all"
          >
            Run AI Verification
          </button>
        </div>

      </div>
    </div>
  );
}
