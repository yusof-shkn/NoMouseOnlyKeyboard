import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import styled from "styled-components";
import { motion, AnimatePresence } from "motion/react";
import { useTour } from "../contexts/TourContext";
import {
  Sparkles,
  ArrowRight,
  Check,
  X,
  MessageCircle,
  Compass,
} from "lucide-react";
import {
  sendMessage,
  initializeGemini,
  INTRO_GAME_PROMPT,
  JARVIS_SYSTEM_PROMPT,
} from "../components/Geminiservice";
import {
  checkExistingVisitor,
  createVisitor,
  updateVisitorInSupabase,
  addUserInterest,
  saveConversationContext,
  getAIMemorySummary,
  type VisitorData,
} from "../components/Visitordatabase";
import {
  createConversation,
  createMessage,
  updateConversationTimestamp,
  logUserInteraction,
} from "../utils/supabaseQueries";

// ... (keep all your existing styled components)

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-top: 100px;
  position: relative;

  @media (max-width: ${(props) => props.theme.breakpoints.mobile}) {
    padding-top: 80px;
  }
`;

const ChatContainer = styled(motion.div)`
  flex: 1;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
  padding: ${(props) => props.theme.spacing.xl};
  padding-bottom: 140px;
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.lg};
  overflow-y: auto;

  @media (max-width: ${(props) => props.theme.breakpoints.mobile}) {
    padding: ${(props) => props.theme.spacing.md};
    padding-bottom: 120px;
  }
`;

const Message = styled(motion.div)<{ $sender: "ai" | "user" }>`
  display: flex;
  gap: ${(props) => props.theme.spacing.md};
  align-items: flex-start;
  ${(props) => props.$sender === "user" && "flex-direction: row-reverse;"}
`;

const Avatar = styled.div<{ $sender: "ai" | "user" }>`
  width: 45px;
  height: 45px;
  border-radius: ${(props) => props.theme.borderRadius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) =>
    props.$sender === "ai"
      ? props.theme.gradients.primary
      : props.theme.colors.background.tertiary};
  color: ${(props) => props.theme.colors.text.primary};
  font-weight: ${(props) => props.theme.typography.fontWeight.bold};
  flex-shrink: 0;
  box-shadow: ${(props) => props.theme.shadows.glow};
  border: 1px solid ${(props) => props.theme.colors.border.default};
  font-size: 0.8rem;
`;

const MessageBubble = styled.div<{ $sender: "ai" | "user" }>`
  background: ${(props) =>
    props.$sender === "ai"
      ? props.theme.colors.background.card
      : props.theme.gradients.card};
  border: 1px solid ${(props) => props.theme.colors.border.default};
  border-radius: ${(props) => props.theme.borderRadius.lg};
  padding: ${(props) => props.theme.spacing.md}
    ${(props) => props.theme.spacing.lg};
  color: ${(props) => props.theme.colors.text.primary};
  font-size: ${(props) => props.theme.typography.fontSize.base};
  line-height: 1.6;
  max-width: 85%;
  box-shadow: ${(props) => props.theme.shadows.card};

  @media (max-width: ${(props) => props.theme.breakpoints.mobile}) {
    max-width: 100%;
  }
`;

const InputContainer = styled(motion.div)<{ $isCentered: boolean }>`
  position: fixed;
  margin-bottom: 2rem;
  bottom: ${(props) => (props.$isCentered ? "40%" : "0")};
  left: 0;
  right: 0;
  transform: ${(props) =>
    props.$isCentered ? "translateY(50%)" : "translateY(0)"};
  z-index: 1;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
`;

const WelcomeContainer = styled(motion.div)`
  text-align: center;
  z-index: 1;
  pointer-events: none;
  padding-bottom: 1rem;

  h1 {
    font-size: ${(props) => props.theme.typography.fontSize["3xl"]};
    font-weight: ${(props) => props.theme.typography.fontWeight.bold};
    color: ${(props) => props.theme.colors.text.primary};
    margin-bottom: ${(props) => props.theme.spacing.sm};
    line-height: 1.2;
  }

  p {
    font-size: ${(props) => props.theme.typography.fontSize.lg};
    color: ${(props) => props.theme.colors.text.secondary};
    margin: 0;
    line-height: 1.5;
  }

  @media (max-width: ${(props) => props.theme.breakpoints.mobile}) {
    padding: ${(props) => props.theme.spacing.md};
    margin-top: -180px;

    h1 {
      font-size: ${(props) => props.theme.typography.fontSize["2xl"]};
    }

    p {
      font-size: ${(props) => props.theme.typography.fontSize.base};
    }
  }
`;

const InputWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 700px;
  margin: 0 auto;
  padding: 0 ${(props) => props.theme.spacing.md};
  gap: ${(props) => props.theme.spacing.sm};
`;

const Input = styled.input`
  flex: 1;
  background: ${(props) => props.theme.colors.background.secondary};
  border: 1px solid ${(props) => props.theme.colors.border.default};
  border-radius: 20px;
  padding: 14px 20px;
  color: ${(props) => props.theme.colors.text.primary};
  font-size: ${(props) => props.theme.typography.fontSize.base};
  font-family: ${(props) => props.theme.typography.fontFamily.primary};
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.colors.accent.green};
    box-shadow:
      0 0 15px rgba(0, 235, 61, 0.15),
      0 0 30px rgba(0, 235, 61, 0.08);
  }

  &::placeholder {
    color: ${(props) => props.theme.colors.text.muted};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Button = styled.button<{ $variant?: "primary" | "secondary" }>`
  min-width: 52px;
  height: 52px;
  padding: 0;
  background: ${(props) =>
    props.$variant === "primary"
      ? props.theme.gradients.primary
      : "transparent"};
  color: ${(props) => props.theme.colors.text.primary};
  border: 1px solid
    ${(props) =>
      props.$variant === "primary"
        ? "transparent"
        : props.theme.colors.border.default};
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: ${(props) => props.theme.shadows.glow};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 22px;
    height: 22px;
    stroke-width: 2.5;
  }
`;

const ChoiceButtons = styled(motion.div)`
  display: flex;
  gap: ${(props) => props.theme.spacing.md};
  margin-top: ${(props) => props.theme.spacing.md};
  flex-wrap: wrap;
  justify-content: center;
`;

const ChoiceButton = styled(Button)`
  flex: 1;
  min-width: 140px;
  justify-content: center;
  padding: 0 ${(props) => props.theme.spacing.md};
  gap: ${(props) => props.theme.spacing.xs};
`;

const TypingIndicator = styled(motion.div)`
  display: flex;
  gap: 6px;
  padding: ${(props) => props.theme.spacing.md};
`;

const Dot = styled(motion.div)`
  width: 8px;
  height: 8px;
  border-radius: ${(props) => props.theme.borderRadius.full};
  background: ${(props) => props.theme.colors.accent.cyan};
`;

const WelcomeBackContainer = styled(motion.div)`
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
  padding: ${(props) => props.theme.spacing.xl};

  h2 {
    font-size: ${(props) => props.theme.typography.fontSize["2xl"]};
    font-weight: ${(props) => props.theme.typography.fontWeight.bold};
    color: ${(props) => props.theme.colors.text.primary};
    margin-bottom: ${(props) => props.theme.spacing.md};
  }

  p {
    font-size: ${(props) => props.theme.typography.fontSize.lg};
    color: ${(props) => props.theme.colors.text.secondary};
    margin-bottom: ${(props) => props.theme.spacing.lg};
    line-height: 1.6;
  }

  .subtitle {
    font-size: ${(props) => props.theme.typography.fontSize.base};
    color: ${(props) => props.theme.colors.text.muted};
    margin-top: ${(props) => props.theme.spacing.md};
  }
`;

const InterestTag = styled.span`
  display: inline-block;
  padding: ${(props) => props.theme.spacing.xs}
    ${(props) => props.theme.spacing.sm};
  background: ${(props) => props.theme.colors.background.tertiary};
  border: 1px solid ${(props) => props.theme.colors.border.default};
  border-radius: ${(props) => props.theme.borderRadius.md};
  font-size: ${(props) => props.theme.typography.fontSize.sm};
  color: ${(props) => props.theme.colors.accent.cyan};
  margin: ${(props) => props.theme.spacing.xs};
`;

interface ChatMessage {
  sender: "ai" | "user";
  text: string;
}

type GamePhase = "intro" | "chat" | "complete";
type ReturningUserMode = "welcome" | "chat";

const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning! ";
  else if (hour >= 12 && hour < 17) return "Good afternoon! ";
  else if (hour >= 17 && hour < 22) return "Good evening! ";
  else return "Good night! ";
};

const extractHobbies = (messages: ChatMessage[]): string[] => {
  const msgText = messages.map((m) => m.text).join(" ");
  const hobbyMatches = msgText.match(
    /(?:hobby|hobbies|interest|love|enjoy|like)\s+(?:is|are)?\s*([^.!?]+)/gi,
  );

  if (!hobbyMatches) return [];

  return hobbyMatches.map((h) =>
    h
      .replace(
        /(?:hobby|hobbies|interest|love|enjoy|like)\s+(?:is|are)?\s*/i,
        "",
      )
      .trim(),
  );
};

export const AIIntroPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUserName, setUserInterest } = useTour();
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userName, setUserNameLocal] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [greeting, setGreeting] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [returningUserMode, setReturningUserMode] =
    useState<ReturningUserMode>("welcome");
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [existingVisitor, setExistingVisitor] = useState<VisitorData | null>(
    null,
  );
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGreeting(getTimeBasedGreeting());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (apiKey && apiKey !== "") {
      initializeGemini(apiKey);
      setApiKeySet(true);
    }
  }, []);

  // Check for existing visitor on mount
  useEffect(() => {
    const checkVisitor = async () => {
      setIsCheckingUser(true);

      const visitor = await checkExistingVisitor();

      if (visitor) {
        console.log("AI remembers visitor:", visitor.name);
        setExistingVisitor(visitor);
        setIsReturningUser(true);
        setReturningUserMode("welcome");
        setCurrentUserId(visitor.id);
        setUserNameLocal(visitor.name);
        setUserName(visitor.name);

        if (visitor.hobbies && visitor.hobbies.length > 0) {
          setUserInterest(visitor.hobbies.join(", "));
        }
      } else {
        console.log("New visitor - AI will learn about them");
        setIsReturningUser(false);
      }

      setIsCheckingUser(false);
    };

    if (apiKeySet) {
      checkVisitor();
    }
  }, [apiKeySet, setUserName, setUserInterest]);

  const addMessage = (text: string, sender: "ai" | "user") => {
    setMessages((prev) => [...prev, { sender, text }]);
  };

  const saveMessageToDb = async (text: string, role: "user" | "assistant") => {
    if (!currentUserId || !currentConversationId) return;

    try {
      await createMessage({
        conversation_id: currentConversationId,
        user_id: currentUserId,
        role,
        content: text,
      });

      await updateConversationTimestamp(currentConversationId);
    } catch (error) {
      console.error("Error saving message to AI memory:", error);
    }
  };

  // Start chat mode for returning users
  const handleStartChat = async () => {
    if (!existingVisitor || !currentUserId) return;

    setReturningUserMode("chat");
    setPhase("chat");

    try {
      // Create new conversation for this chat session
      const { data: newConversation } = await createConversation(
        currentUserId,
        `Chat Session - ${new Date().toLocaleDateString()}`,
      );

      if (newConversation) {
        setCurrentConversationId(newConversation.id);
      }

      // Get AI memory and greet returning user
      const aiMemory = await getAIMemorySummary(currentUserId);

      const welcomeMessage = await sendMessage(
        `${JARVIS_SYSTEM_PROMPT}\n\nWhat I remember about this user:\n${aiMemory}\n\nThis is a returning visitor named ${existingVisitor.name}. Greet them warmly, mention something you remember about them (like their interests), and ask what they'd like to know about Yusof's work today.`,
        [],
      );

      addMessage(welcomeMessage, "ai");
      setConversationHistory([{ role: "assistant", parts: welcomeMessage }]);

      // Save greeting to database
      await saveMessageToDb(welcomeMessage, "assistant");

      // Log chat started
      await logUserInteraction({
        user_id: currentUserId,
        interaction_type: "returning_chat_started",
        interaction_data: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error starting chat:", error);
      addMessage(
        `Welcome back, ${existingVisitor.name}! What would you like to know about Yusof's work?`,
        "ai",
      );
    }
  };

  const handleUserMessage = async () => {
    if (!inputValue.trim() || !apiKeySet || isTyping) return;

    const userMsg = inputValue.trim();
    const isFirstMessage = messages.length === 0;

    addMessage(userMsg, "user");
    setInputValue("");

    // Create new visitor (new user)
    if (!userName && isFirstMessage && !isReturningUser) {
      const extractedName = userMsg;
      setUserNameLocal(extractedName);
      setUserName(extractedName);

      try {
        const newVisitor = await createVisitor({
          name: extractedName,
          hobbies: [],
        });

        if (newVisitor) {
          setCurrentUserId(newVisitor.id);
          setExistingVisitor(newVisitor);

          const { data: newConversation } = await createConversation(
            newVisitor.id,
            "Intro Conversation",
          );

          if (newConversation) {
            setCurrentConversationId(newConversation.id);
          }

          await logUserInteraction({
            user_id: newVisitor.id,
            interaction_type: "intro_started",
            interaction_data: {
              startedAt: new Date().toISOString(),
            },
          });
        }
      } catch (error) {
        console.error("Error creating visitor in AI memory:", error);
      }
    }

    await saveMessageToDb(userMsg, "user");

    setIsTyping(true);
    try {
      let response;

      if (isFirstMessage && !isReturningUser) {
        response = await sendMessage(
          `${INTRO_GAME_PROMPT}\n\nThe user just said: "${userMsg}". This is their first message. Greet them warmly, acknowledge their name, and ask them about their interests or hobbies.`,
          [],
        );
        setConversationHistory([
          { role: "user", parts: userMsg },
          { role: "assistant", parts: response },
        ]);
      } else {
        const updatedHistory = [
          ...conversationHistory,
          { role: "user", parts: userMsg },
        ];
        setConversationHistory(updatedHistory);

        // Get AI memory context
        let aiMemory = "";
        if (currentUserId) {
          aiMemory = await getAIMemorySummary(currentUserId);
        }

        const systemPrompt =
          phase === "intro" ? INTRO_GAME_PROMPT : JARVIS_SYSTEM_PROMPT;

        const promptWithMemory = aiMemory
          ? `${systemPrompt}\n\nWhat I remember about this user:\n${aiMemory}\n\nUser message: ${userMsg}`
          : `${systemPrompt}\n\nUser message: ${userMsg}`;

        response = await sendMessage(promptWithMemory, updatedHistory);

        setConversationHistory([
          ...updatedHistory,
          { role: "assistant", parts: response },
        ]);

        // Extract and save interests to AI memory
        if (currentUserId && phase === "intro") {
          const hobbyKeywords = [
            "hobby",
            "hobbies",
            "interest",
            "interests",
            "love",
            "enjoy",
            "like",
            "passion",
          ];
          const lowerMsg = userMsg.toLowerCase();

          if (hobbyKeywords.some((keyword) => lowerMsg.includes(keyword))) {
            await addUserInterest(
              currentUserId,
              userMsg,
              currentConversationId || undefined,
            );
          }
        }
      }

      setIsTyping(false);
      addMessage(response, "ai");
      await saveMessageToDb(response, "assistant");

      if (phase === "intro" && conversationHistory.length >= 6) {
        setPhase("chat");

        if (currentUserId) {
          await logUserInteraction({
            user_id: currentUserId,
            interaction_type: "intro_phase_completed",
            interaction_data: {
              messageCount: conversationHistory.length,
              completedAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      setIsTyping(false);
      addMessage(
        "Sorry, I'm having trouble right now. Can you try again?",
        "ai",
      );
    }
  };

  const handleCompleteTour = async () => {
    if (currentUserId && currentConversationId) {
      try {
        const hobbies = extractHobbies(messages);

        await updateVisitorInSupabase(currentUserId, {
          hobbies,
          conversationSummary: messages
            .map((m) => `${m.sender === "ai" ? "Jarvis" : userName}: ${m.text}`)
            .join("\n"),
        });

        await saveConversationContext(
          currentUserId,
          currentConversationId,
          "intro_completed",
          new Date().toISOString(),
        );

        await logUserInteraction({
          user_id: currentUserId,
          interaction_type: "tour_completed",
          interaction_data: {
            totalMessages: messages.length,
            hobbiesLearned: hobbies.length,
            completedAt: new Date().toISOString(),
          },
        });

        if (hobbies.length > 0) {
          setUserInterest(hobbies.join(", "));
        }
      } catch (error) {
        console.error("Error completing tour:", error);
      }
    }

    setPhase("complete");
  };

  const handleStartPortfolio = () => {
    navigate("/projects");
  };

  const handleSkipIntro = () => {
    navigate("/projects");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUserMessage();
    }
  };

  // Loading state
  if (isCheckingUser) {
    return (
      <Container>
        <ChatContainer>
          <Message $sender="ai">
            <Avatar $sender="ai">J</Avatar>
            <MessageBubble $sender="ai">
              <TypingIndicator>
                <Dot
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                />
                <Dot
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                />
                <Dot
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                />
              </TypingIndicator>
            </MessageBubble>
          </Message>
        </ChatContainer>
      </Container>
    );
  }

  // Returning user - welcome screen with TWO options
  if (isReturningUser && existingVisitor && returningUserMode === "welcome") {
    return (
      <Container>
        <ChatContainer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <WelcomeBackContainer
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h2>Welcome back, {existingVisitor.name}! 👋</h2>
            <p>Great to see you again! What would you like to do today?</p>

            {existingVisitor.hobbies && existingVisitor.hobbies.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <p className="subtitle" style={{ marginBottom: "0.5rem" }}>
                  I remember you're interested in:
                </p>
                {existingVisitor.hobbies.map((hobby, index) => (
                  <InterestTag key={index}>{hobby}</InterestTag>
                ))}
              </div>
            )}

            <ChoiceButtons
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <ChoiceButton $variant="primary" onClick={handleStartChat}>
                <MessageCircle />
                Chat with Jarvis
              </ChoiceButton>
              <ChoiceButton onClick={handleStartPortfolio}>
                <Compass />
                Explore Portfolio
              </ChoiceButton>
            </ChoiceButtons>

            <p
              className="subtitle"
              style={{ marginTop: "1rem", fontSize: "0.85rem" }}
            >
              💬 Chat to ask me anything about Yusof's work, or explore the
              portfolio with the guided tour
            </p>
          </WelcomeBackContainer>
        </ChatContainer>
      </Container>
    );
  }

  // API key check
  if (!apiKeySet) {
    return (
      <Container>
        <ChatContainer>
          <MessageBubble $sender="ai">
            <p>
              Please set your Gemini API key in the environment variables
              (VITE_GEMINI_API_KEY) to use the AI introduction.
            </p>
          </MessageBubble>
          <ChoiceButtons>
            <ChoiceButton $variant="primary" onClick={handleSkipIntro}>
              Skip to Portfolio
            </ChoiceButton>
          </ChoiceButtons>
        </ChatContainer>
      </Container>
    );
  }

  // Chat interface (for new users OR returning users who chose to chat)
  return (
    <Container>
      <ChatContainer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {messages.map((message, index) => (
          <Message
            key={index}
            $sender={message.sender}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Avatar $sender={message.sender}>
              {message.sender === "ai"
                ? "J"
                : userName
                  ? userName.charAt(0).toUpperCase()
                  : "?"}
            </Avatar>
            <MessageBubble $sender={message.sender}>
              {message.text}
            </MessageBubble>
          </Message>
        ))}

        {isTyping && (
          <Message $sender="ai">
            <Avatar $sender="ai">J</Avatar>
            <MessageBubble $sender="ai">
              <TypingIndicator>
                <Dot
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                />
                <Dot
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                />
                <Dot
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                />
              </TypingIndicator>
            </MessageBubble>
          </Message>
        )}

        {/* Show "Explore Portfolio" button for new users after intro phase */}
        {phase === "chat" &&
          conversationHistory.length >= 8 &&
          !isReturningUser && (
            <ChoiceButtons
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ChoiceButton $variant="primary" onClick={handleCompleteTour}>
                <Sparkles style={{ marginRight: "8px" }} />
                Explore Portfolio
              </ChoiceButton>
            </ChoiceButtons>
          )}

        {/* Completion screen for new users */}
        {phase === "complete" && !isReturningUser && (
          <ChoiceButtons
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ChoiceButton $variant="primary" onClick={handleStartPortfolio}>
              <Check style={{ marginRight: "8px" }} />
              Enter Portfolio
            </ChoiceButton>
            <ChoiceButton onClick={handleSkipIntro}>
              <X style={{ marginRight: "8px" }} />
              Skip to Projects
            </ChoiceButton>
          </ChoiceButtons>
        )}

        <div ref={chatEndRef} />
      </ChatContainer>

      {/* Input area - show for active chat sessions */}
      {phase !== "complete" && (
        <InputContainer
          $isCentered={messages.length === 0 && !isReturningUser}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatePresence>
            {messages.length === 0 && !isReturningUser && (
              <WelcomeContainer
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
              >
                <h1>{greeting}</h1>
                <p>
                  It's Jarvis, before we explore Yusof's work, let's get to know
                  each other.
                </p>
              </WelcomeContainer>
            )}
          </AnimatePresence>
          <InputWrapper>
            <Input
              type="text"
              placeholder={
                messages.length === 0 && !isReturningUser
                  ? "What's your name?"
                  : phase === "intro"
                    ? "Type your response..."
                    : "Ask me anything about Yusof's work..."
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isTyping}
              autoFocus
            />
            <Button
              $variant="primary"
              onClick={handleUserMessage}
              disabled={!inputValue.trim() || isTyping}
            >
              <ArrowRight />
            </Button>
          </InputWrapper>
        </InputContainer>
      )}
    </Container>
  );
};
