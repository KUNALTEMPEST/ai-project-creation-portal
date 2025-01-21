import React, { useState, useEffect, useRef } from "react";
import { RxKeyboard } from "react-icons/rx";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa6";
import { BotMessage, UserMessage } from "../chatMessage";
import Header from "../header/Header";
import "../stylesheet/chatStyle.css";
import { getFirstPageMessages } from "../question script/bot_user_questions";
import { getNewLocalTime, ShowLoader } from "../MainPage";
import { createChatSession, getChatsFromDB, getNewSessionID, getObjectiveList, getParaphraseText, saveUserChatsInDB } from "../../../api services/chat_flow_api";
import { getEncodedLocalStorage, setEncodedLocalStorage } from "../../../utils/storage_utils";
import { getDenyButtonTranslation, getInputPlaceholderTranslation, getKeyboardButtonTranslation, 
    getVoiceButtonTranslation, getVoiceStopButtonTranslation } from "../question script/firstpage_translation";


function FirstPage( { 
    isBotTalking, handleSpeakerOn, handleSpeakerOff, 
    userInput, setUserInput, currentChatValue, setCurrentChatValue, isUsingMicrophone, setIsUsingMicrophone, 
    startRecording, stopRecording, setHasStartedRecording, userDetail, setChatHistory, isLoading, setIsLoading,
    isReadOnly, handleGoForward, setCurrentPageValue, isProcessingAudio, setIsProcessingAudio, setCurrentPage,
    errorMessage, setErrorMessage, showTyping, setShowTyping
}) {

    const [useTextbox, setUseTextbox] = useState(false);
    const [userProblemStatement, setUserProblemStatement] = useState(getEncodedLocalStorage('user_problem_statement') || '');
    const [shouldMoveForward, setShouldMoveForward] = useState(false);
    const [localChatHistory, setLocalChatHistory] = useState(false);
    const [currentSession, setCurrentSession]= useState(getEncodedLocalStorage('session'));
    const [currentProfile, setCurrentProfile] = useState(getEncodedLocalStorage('profile_id'));
    const [validatedType, setValidatedType] = useState('');

    const savedMessagesRef = useRef(new Set());
    const textInputRef = useRef(null);
    const scrollRef = useRef(null);

    const preferredLanguage = JSON.parse(localStorage.getItem('preferred_language') || '{}');
    const language = preferredLanguage.value || 'en';

    let firstpage_messages = getFirstPageMessages(userDetail, userInput, userProblemStatement, language);

    useEffect(()=>{
        firstpage_messages = getFirstPageMessages(userDetail, userInput, userProblemStatement);
    }, [userDetail])


    useEffect(()=>{
        async function getUpdateSession() {
            
            if(!getEncodedLocalStorage('session')) {
                const session = await getNewSessionID();
                if(session){
                    setEncodedLocalStorage('session', session);
                    setCurrentSession(session)
                    const email = localStorage.getItem('email');
                    const access_token = localStorage.getItem(process.env.REACT_APP_ACCESS_TOKEN_KEY);
                    const response = await createChatSession(session, email, access_token);
                    
                    if (response) {
                        setEncodedLocalStorage('profile_id', response?.chatsession?.profile_id);
                        setCurrentProfile(response?.chatsession?.profile_id)
                    }
                }
            }
        }
        getUpdateSession()
    }, [])


    useEffect(()=>{
        async function fetchParaphrasedText() {
            const denyMessage = getDenyButtonTranslation(language).toLowerCase();
            if (userInput && userInput[0] && currentChatValue === 1 && userProblemStatement === '') {
                setShowTyping(true);
                
                let paraphrased_text = await getParaphraseText(userInput[0], language, true);
                if (paraphrased_text) {
                    if (typeof paraphrased_text !== 'string') {
                        setValidatedType(paraphrased_text?.type);
                        paraphrased_text = paraphrased_text.is_validated;
                    }
                    setEncodedLocalStorage('user_problem_statement', paraphrased_text);
                    setUserProblemStatement(paraphrased_text);
                    setShowTyping(false);
                } else {
                    window.location.reload();
                }
            } else if (currentChatValue === 3 && userInput && userInput[2] && (/नहीं/i.test(userInput[1]) || /no/i.test(userInput[1])) && !isReadOnly) {
                setEncodedLocalStorage('user_problem_statement', userInput[2]);
                
                setUserProblemStatement(userInput[2]);
                setShowTyping(false);
            }
        }
        fetchParaphrasedText();
    }, [userInput, currentChatValue, isReadOnly])


    useEffect(() => {
        if (useTextbox && textInputRef.current) {
            textInputRef.current.focus();  
        }
    }, [useTextbox]);

    async function handleSendText(e) {
        let validatedText;
        if(isReadOnly) {
            setShowTyping(true);            
            const keyboardTypedValue = e?.target?.value;
            validatedText = await getParaphraseText(e?.target?.value, language);
            setValidatedType(validatedText?.type);
            validatedText = validatedText?.is_validated;
            if(validatedText && validatedText.toLowerCase() === 'no') {
                setEncodedLocalStorage('user_problem_statement', validatedText);
                setUserProblemStatement(validatedText);
                setEncodedLocalStorage('errorText', validatedText);
                setErrorMessage(validatedText)
            } else {
                setEncodedLocalStorage('user_problem_statement', keyboardTypedValue);
                setUserProblemStatement(keyboardTypedValue);
            }
            setShowTyping(false);            
            
        } else {
            setUserInput((prevInput)=>{
                const keyboardTypedValue = e?.target?.value;
                return [...prevInput, keyboardTypedValue]
            });
            if(currentChatValue >= 2) {
                setShowTyping(true);            
                validatedText = await getParaphraseText(e?.target?.value, language);
                setValidatedType(validatedText?.type);
                validatedText = validatedText?.is_validated;
                if(validatedText && validatedText.toLowerCase() === 'no') {
                    setEncodedLocalStorage('errorText', validatedText);
                    setErrorMessage(validatedText)
                }
            }
            setShowTyping(false);
        }

        if(isReadOnly) {
            if (Number.isInteger(currentChatValue) && validatedText.toLowerCase() !=='no') {
                setCurrentChatValue((prevValue) => {
                    return prevValue + 1;
                });
            }
        }else if (Number.isInteger(currentChatValue)) {
            setCurrentChatValue((prevValue) => {
                return prevValue + 1;
            });
        }

        
        setTimeout(() => {
            e.target.value = "";
        }, 1);

        if(isReadOnly && validatedText !== 'no') {
            setShouldMoveForward(true);
            setEncodedLocalStorage('currentPage', {
                1: false,
                2: false,
                3: false,
                4: false,
                5: false,
            })
            setCurrentPage({
                1: false,
                2: false,
                3: false,
                4: false,
                5: false,
            })
        }

    }

    useEffect(()=>{
        if (isReadOnly && errorMessage !== 'no') {
            setIsLoading(true);
            setCurrentChatValue(3);
            localStorage.removeItem('selected_objective');
            localStorage.removeItem('objective');
            localStorage.removeItem('user_problem_statement');
            localStorage.removeItem('hasClickedObjAddMore');
            setUserProblemStatement('');
            setIsLoading(false);
        }
    }, [isReadOnly, errorMessage])
    
    // useEffect(()=>{
    //     console.log("Error Message: ", errorMessage)
    //     console.log("Currentchatvalue: ", currentChatValue)
    //     console.log('userInput: ', userInput)
    // }, [errorMessage])


    useEffect(() => {
        
        
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
        const errorText = getEncodedLocalStorage('errorText');
        if (currentChatValue === 3 && !isReadOnly && errorMessage === '') {
            // if((errorText === '' || !errorText))
            setIsLoading(true);
            localStorage.removeItem("errorText");
            setCurrentChatValue(4);
            setCurrentPageValue(1)
        }

    }, [currentChatValue]);

    useEffect(() => {
        
        
        if(!currentSession || !currentProfile || !firstpage_messages) return;
        const savedMessages = new Set(JSON.parse(localStorage.getItem('savedMessages') || '[]'));


        if (isReadOnly) {
            async function fetchAllChats() {
                try {
                    const allChats = await getChatsFromDB(currentSession); 
                    if (allChats) {
                        setLocalChatHistory(allChats); 
                    }
                } catch (error) {
                    console.error("Error fetching chats:", error);
                }
            }
    
            fetchAllChats();
        } else {
            const processedMessages = (firstpage_messages[currentChatValue] || []).reduce((acc, curr) => {
                const isDuplicate = 
                    acc.some(message => message.uniqueId === curr.messageId) ||
                    acc.some(message => message.originalMessageIds?.includes(curr.messageId));
        
                if (isDuplicate) {
                    return acc;
                }
                
                if (curr.role === "bot" && acc.length > 0 && acc[acc.length - 1].role === "bot") {
                    const lastMessage = acc[acc.length - 1];
                    lastMessage.message += ` ${curr.message}`;
                    lastMessage.originalMessageIds.push(curr.messageId);
                    lastMessage.uniqueId = lastMessage.originalMessageIds.join('_');
                } else {
                    acc.push({
                        ...curr,
                        uniqueId: curr.messageId,
                        originalMessageIds: [curr.messageId],
                    });
                }
                return acc;
            }, []);
    
            processedMessages.forEach(message => {
                if (!savedMessages.has(message.uniqueId)) {
                    saveUserChatsInDB(message?.message, currentSession, message.role); 
                    savedMessages.add(message.uniqueId); 
                }
            });
    
            localStorage.setItem('savedMessages', JSON.stringify([...savedMessages]));
        }
    }, [currentChatValue, isReadOnly, currentSession, currentProfile]);
    

    function showMicAndKeyboard() {
        return(
            <>
                {(!isUsingMicrophone && !useTextbox && !isProcessingAudio) &&
                    <div className={currentChatValue === 0 ? "mic-container" : ""}>
                        <div className="thirdpara-div">
                            <button 
                                className="microphone-button-gif-div"
                                onClick={()=>{
                                    setUseTextbox(false);
                                    setIsUsingMicrophone(true);
                                    setHasStartedRecording(true);
                                    startRecording()
                                }}
                            >
                                <img src="https://static-media.gritworks.ai/fe-images/GIF/Shikshalokam/mic.gif" className="mic-gif" />
                                {/* <RiMic2Fill className="microphone-button-icon" /> */}
                            </button>
                        </div>
                        <div className="fourthpara-div">
                            <button className="use-text-button"
                                onClick={()=>{
                                    setUseTextbox(true);
                                    setIsUsingMicrophone(false);
                                    
                                }}
                            >
                                <RxKeyboard />
                                {getKeyboardButtonTranslation(language)}
                            </button>
                        </div>
                    </div>
                }
                {(isUsingMicrophone && !isProcessingAudio) && (
                    <div 
                        className={`audio-visualizer ${currentChatValue === 0 && "mic-container"}`}
                        onClick={stopRecording}
                    >
                        <img src="https://static-media.gritworks.ai/fe-images/GIF/Shikshalokam/voice_loader.gif" className="voice-loader-bot" />
                        <div className="">
                            <button className="use-text-button"
                                onClick={stopRecording}
                            >
                                <FaMicrophoneSlash />
                                {getVoiceStopButtonTranslation(language)}
                            </button>
                        </div>
                    </div>
                )}
                {(isProcessingAudio) && (
                    <>
                        <div className="firstpage-reply-text"
                            onLoad={() => document.querySelector('.firstpage-reply-text')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            <p className="secondpage-para1">processing audio please wait...</p>
                        </div>
                    </>
                )}
            </>
        );
    }

    function showTextBox() {
        
        return (
            <>
                {(useTextbox && !isUsingMicrophone)&&
                    <div id="textbox-id" className={currentChatValue === 0 ? "textbox-container": ""}>
                        <div className="fourthpara-div-1">
                            <button className="use-text-button"
                                onClick={()=>{
                                    setUseTextbox(false);
                                    setIsUsingMicrophone(false);
                                }}
                            >
                                <FaMicrophone />
                                {getVoiceButtonTranslation(language)}
                            </button>
                        </div>
                        <input
                            ref={textInputRef}
                            type="text"
                            placeholder={getInputPlaceholderTranslation(language)}
                            onFocus={() => {
                                document.getElementById("textbox-id").classList.remove('textbox-container');
                            }}
                            onBlur={() => {
                                if (currentChatValue === 0){
                                    document.getElementById("textbox-id").classList.add('textbox-container');
                                }
                            }}
                            className="firstpage-text-input"
                            onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                    try {
                                        await handleSendText(e);
                                    } catch (error) {
                                        console.error("Error handling text:", error);
                                    }
                            
                                }
                            }}
                        />
                    </div>
                }
            </>
        );
    }

    function showErrorBotMessage() {

        return (
            <div className="firstpage-bot-div" 
                ref={currentChatValue === 1 ? scrollRef : null}
            >
                <BotMessage 
                    botMessage={
                        validatedType === 'NO_PROBLEM_STATEMENT' ? 
                        firstpage_messages[12]?.[0]?.message :
                        firstpage_messages[11]?.[0]?.message
                    }
                    secondMessageClass={"firstpage-para2"}
                    firstparaClass={"firstpara-div"}
                    firstpageClass={"firstpage-para1"}
                    secondParaClass={"secondpara-div"}
                    useTextbox={useTextbox}
                    isUsingMicrophone={isUsingMicrophone} 
                    currentChatValue={currentChatValue}
                    showFirst={true}
                    setCurrentChatValue={setCurrentChatValue}
                    setIsUsingMicrophone={setIsUsingMicrophone}
                    setUseTextbox={setUseTextbox}
                    setUserInput={setUserInput}
                    handleSpeakerOn={handleSpeakerOn}
                    isBotTalking={isBotTalking}
                    audioId={11}
                    handleSpeakerOff={handleSpeakerOff}
                    showExplore={validatedType === 'NO_PROBLEM_STATEMENT' ? true: false}
                />
            </div>
        );
   
    }

    
    return (
        <>
            {isLoading&& <ShowLoader />}

            <Header shouldEnableCross={true} />
            {<div className="firstpage-div" 
                ref={currentChatValue === 0 ? scrollRef : null}
            >
                <BotMessage 
                    botMessage={
                        firstpage_messages[0]?.[0]?.message
                    }
                    firstparaClass={"firstpara-div"}
                    firstpageClass={"firstpage-para1"}
                    secondParaClass={"secondpara-div"}
                    secondMessageClass={"firstpage-para2"}
                    useTextbox={useTextbox} 
                    isUsingMicrophone={isUsingMicrophone} 
                    currentChatValue={currentChatValue}
                    showFirst={true}
                    showSecond={true}
                    botSecondMessage={
                        firstpage_messages[0]?.[1]?.message
                    }
                    handleSpeakerOn={handleSpeakerOn}
                    isBotTalking={isBotTalking}
                    audioId={1.1}
                    handleSpeakerOff={handleSpeakerOff}
                />
                {(currentChatValue == 0 && !showTyping && errorMessage === '') &&
                    <>
                        {showMicAndKeyboard()}
                        {showTextBox()}
                    </>
                    
                }
                {(currentChatValue > 0)&&
                    <UserMessage userMessage={
                        (userInput && userInput[0]) ? userInput[0]: ""}
                        userDetail={userDetail}
                    />
                }
                {(currentChatValue>0 && (userProblemStatement || isReadOnly))&&
                    <>
                        {(userProblemStatement.toLowerCase() === 'no')?
                            <>
                                {showErrorBotMessage()}
                            </>
                            :
                            <>
                                <div className="firstpage-bot-div" 
                                    ref={currentChatValue === 1 ? scrollRef : null}
                                >
                                    <BotMessage 
                                        botMessage={
                                            firstpage_messages[1]?.[1]?.message
                                        }
                                        botSecondMessage={
                                            firstpage_messages[1]?.[2]?.message
                                        }
                                        secondMessageClass={"firstpage-para2"}
                                        firstparaClass={"firstpara-div"}
                                        firstpageClass={"firstpage-para1"}
                                        secondParaClass={"secondpara-div"}
                                        useTextbox={useTextbox}
                                        isUsingMicrophone={isUsingMicrophone} 
                                        currentChatValue={currentChatValue}
                                        showFirst={true}
                                        showSecond={true}
                                        showThird={true}
                                        setCurrentChatValue={setCurrentChatValue}
                                        setIsUsingMicrophone={setIsUsingMicrophone}
                                        setUseTextbox={setUseTextbox}
                                        setUserInput={setUserInput}
                                        handleSpeakerOn={handleSpeakerOn}
                                        isBotTalking={isBotTalking}
                                        audioId={1.2}
                                        handleSpeakerOff={handleSpeakerOff}
                                    />
                                </div>
                            </>
                        }
                    </>
                }
                {(currentChatValue>=2)&&
                    <>
                        <UserMessage 
                            userMessage={(userInput && userInput[1]) ? userInput[1]: ""}
                            userDetail={userDetail}
                        />
                        {((userInput && userInput[1].toLowerCase() === getDenyButtonTranslation(language).toLowerCase()))&& 
                            <div className="firstpage-bot-div" 
                                ref={currentChatValue === 2 ? scrollRef : null}
                            >
                                <BotMessage 
                                    firstparaClass={"firstpara-div"}
                                    secondParaClass={"secondpara-div"}
                                    secondMessageClass={"firstpage-para2"}
                                    botSecondMessage={
                                        firstpage_messages[2]?.[1]?.message
                                    }
                                    useTextbox={useTextbox} 
                                    isUsingMicrophone={isUsingMicrophone} 
                                    currentChatValue={currentChatValue}
                                    showSecond={true}
                                    handleSpeakerOn={handleSpeakerOn}
                                    handleSpeakerOff={handleSpeakerOff}
                                    isBotTalking={isBotTalking}
                                    audioId={1.3}
                                />
                            </div>
                        }
                        {(currentChatValue===2 && !showTyping && errorMessage === '')&& showMicAndKeyboard()}
                        {(currentChatValue===2 && !showTyping && errorMessage === '')&& showTextBox()}
                    </>
                }
                {(currentChatValue>=3 || (userInput && userInput[2]))&& 
                    <div
                        ref={currentChatValue === 3 ? scrollRef : null}
                    >
                        {(userInput && userInput[2])&&
                            <UserMessage 
                                userMessage={userInput[2]} 
                                userDetail={userDetail}
                            />
                        }
                        {(errorMessage.toLowerCase() === 'no')&&
                            showErrorBotMessage()
                        }
                    </div>
                }   
                {(isReadOnly && errorMessage === '')&&(
                    <div className="firstpage-bot-div" 
                        ref={isReadOnly ? scrollRef : null}
                    >
                        <BotMessage
                            botMessage={firstpage_messages[10]?.[0]?.message}
                            firstparaClass={"firstpara-div"}
                            firstpageClass={"firstpage-para1"}
                            useTextbox={useTextbox} 
                            isUsingMicrophone={isUsingMicrophone} 
                            currentChatValue={currentChatValue}
                            showFirst={true}
                            handleSpeakerOn={handleSpeakerOn}
                            isBotTalking={isBotTalking}
                            audioId={1.10}
                            handleSpeakerOff={handleSpeakerOff}
                        />
                        {(!showTyping && errorMessage === '')&&
                            <>
                                {showMicAndKeyboard()}
                                {showTextBox()}
                            </>
                        }
                        {(userProblemStatement)&&
                            <UserMessage 
                                userMessage={userProblemStatement} 
                                userDetail={userDetail}
                            />
                        }
                    </div>
                )}
            </div>}
            {/* {(isReadOnly && localChatHistory) && localChatHistory.map((chatItem, index) => (
                <div className="firstpage-bot-div"> 
                    <div key={index} className="chat-history-item">
                        {chatItem.sender && chatItem.sender.id === 1 ? (
                            <BotMessage 
                                botMessage={chatItem.message}
                                firstparaClass={"firstpara-div"}
                                firstpageClass={"firstpage-para1"}
                                currentChatValue={currentChatValue}
                                showFirst={true}
                                handleSpeakerOn={handleSpeakerOn}
                                isBotTalking={isBotTalking}
                                audioId={index + 1}
                                handleSpeakerOff={handleSpeakerOff}
                            />
                        ) : (
                            <UserMessage userMessage={chatItem.message} />
                        )}
                    </div>
                </div>
            ))} */}
            {(showTyping)&&
                <div className="firstpage-div1">
                    <div className="firstpage-reply-text"
                        onLoad={() => document.querySelector('.firstpage-reply-text')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                        <p className="secondpage-para1">typing...</p>
                    </div>
                </div>
            }
        </>
    );
}

export default FirstPage;
