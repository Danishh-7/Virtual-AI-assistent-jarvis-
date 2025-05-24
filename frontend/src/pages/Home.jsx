import React, { useContext, useEffect, useRef, useState } from 'react';
import { userDataContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import aiImg from "../assets/ai.gif";
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";
import userImg from "../assets/user.gif";

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext);
  const navigate = useNavigate();

  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [ham, setHam] = useState(false);

  const isSpeakingRef = useRef(false);
  const isRecognizingRef = useRef(false);
  const recognitionRef = useRef(null);
  const selectedVoiceRef = useRef(null);
  const synth = window.speechSynthesis;

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
      setUserData(null);
      navigate("/signin");
    } catch (error) {
      setUserData(null);
      console.error(error);
    }
  };

  const speak = (text) => {
    if (!text) return;
    if (synth.speaking) synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.voice = selectedVoiceRef.current;
    utterance.rate = 1.5;
    utterance.pitch = 0.2;
    utterance.volume = 1.2;

    isSpeakingRef.current = true;
    synth.speak(utterance);

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setAiText("");
      safelyStartRecognition();
    };
  };

  const safelyStartRecognition = () => {
    if (!isRecognizingRef.current && !isSpeakingRef.current) {
      try {
        recognitionRef.current?.start();
        console.log("Recognition started");
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          console.error("Error starting recognition:", error);
        }
      }
    }
  };

  const handleCommand = (data) => {
    const { type, userInput, response } = data;
    speak(response);

    const open = (url) => window.open(url, '_blank');
    const encodedQuery = encodeURIComponent(userInput);

    const actions = {
      "google-search": () => open(`https://www.google.com/search?q=${encodedQuery}`),
      "calculator-open": () => open(`https://www.google.com/search?q=calculator`),
      "instagram-open": () => open(`https://www.instagram.com/`),
      "facebook-open": () => open(`https://www.facebook.com/`),
      "weather-show": () => open(`https://www.google.com/search?q=weather`),
      "youtube-search": () => open(`https://www.youtube.com/results?search_query=${encodedQuery}`),
      
      "youtube-play": () => open(`https://www.youtube.com/results?search_query=${encodedQuery}`),
    };

    actions[type]?.();
  };

  useEffect(() => {
    let isMounted = true;

    const loadVoices = () => {
      const voices = synth.getVoices();
      selectedVoiceRef.current = voices.find(v => v.lang === 'en-IN') || voices.find(v => v.lang.startsWith('en'));
    };

    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
    loadVoices();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      setListening(false);
      if (isMounted && !isSpeakingRef.current) {
        setTimeout(() => safelyStartRecognition(), 1000);
      }
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      isRecognizingRef.current = false;
      setListening(false);
      if (isMounted && !isSpeakingRef.current) {
        setTimeout(() => safelyStartRecognition(), 1000);
      }
    };

    recognition.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      if (transcript.toLowerCase().includes(userData.assistantName.toLowerCase())) {
        recognition.stop();
        isRecognizingRef.current = false;
        setListening(false);
        setUserText(transcript);
        const response = await getGeminiResponse(transcript);
        handleCommand(response);
        setAiText(response.response);
        setUserText("");
      }
    };

    setTimeout(() => {
      speak(`Hello ${userData.name}, what can I help you with?`);
    }, 1000);

    setTimeout(() => safelyStartRecognition(), 2000);

    return () => {
      isMounted = false;
      recognition.stop();
      synth.cancel();
      isRecognizingRef.current = false;
    };
  }, []);

  return (
    <div className='w-full h-screen bg-gradient-to-t from-black to-[#02023d] flex justify-center items-center flex-col gap-4 overflow-hidden'>
      <CgMenuRight className='lg:hidden text-white absolute top-5 right-5 w-6 h-6' onClick={() => setHam(true)} />
      <div className={`absolute lg:hidden top-0 w-full h-full bg-black/50 backdrop-blur p-5 flex flex-col gap-5 items-start ${ham ? "translate-x-0" : "translate-x-full"} transition-transform`}>
        <RxCross1 className='text-white absolute top-5 right-5 w-6 h-6' onClick={() => setHam(false)} />
        <button className='bg-white text-black font-semibold rounded-full px-5 py-3' onClick={handleLogOut}>Log Out</button>
        <button className='bg-white text-black font-semibold rounded-full px-5 py-3' onClick={() => navigate("/customize")}>Customize your Assistant</button>
        <div className='w-full h-px bg-gray-400'></div>
        <h1 className='text-white font-semibold text-lg'>History</h1>
        <div className='w-full h-96 overflow-y-auto text-white space-y-2'>
          {userData.history?.map((his, i) => (
            <div key={i} className='text-sm truncate'>{his}</div>
          ))}
        </div>
      </div>
      <div className='absolute top-5 right-5 hidden lg:block'>
        <button className='bg-white text-black font-semibold rounded-full px-5 py-3 mr-4' onClick={handleLogOut}>Log Out</button>
        <button className='bg-white text-black font-semibold rounded-full px-5 py-3' onClick={() => navigate("/customize")}>Customize your Assistant</button>
      </div>
      <div className='w-72 h-96 flex justify-center items-center overflow-hidden rounded-3xl shadow-lg'>
        <img src={userData?.assistantImage} alt="Assistant" className='h-full object-cover' />
      </div>
      <h1 className='text-white text-lg font-semibold'>I'm {userData?.assistantName}</h1>
      {!aiText && <img src={userImg} alt="User" className='w-52' />}
      {aiText && <img src={aiImg} alt="AI speaking" className='w-52' />}
      <h1 className='text-white text-lg font-semibold text-center px-4'>{userText || aiText}</h1>
    </div>
  );
}

export default Home;
