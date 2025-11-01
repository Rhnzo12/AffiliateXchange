import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  MessageSquare,
  Image as ImageIcon,
  Check,
  CheckCheck,
  WifiOff,
  Loader2,
  Bell,
  BellOff,
  ArrowLeft
} from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";

type MessageStatus = "sending" | "sent" | "failed";

interface EnhancedMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  status?: MessageStatus;
  tempId?: string;
}

export default function Messages() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();
  
  // Get conversation ID from URL query parameter
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const conversationFromUrl = urlParams.get('conversation');
  
  const [selectedConversation, setSelectedConversation] = useState<string | null>(conversationFromUrl);
  const [messageText, setMessageText] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('messageSoundEnabled');
    return saved === null ? true : saved === 'true';
  });
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const lastMessageCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedConversationRef = useRef<string | null>(selectedConversation);
  const userIdRef = useRef<string | undefined>(user?.id);

  // Update refs when values change
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
    // Clear typing users when switching conversations
    setTypingUsers(new Set());
  }, [selectedConversation]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  // Helper function to get display name for user or company
  const getDisplayName = (user: any) => {
    if (!user) return 'User';
    
    // Debug logging to see what fields are available
    console.log('User object in getDisplayName:', user);
    
    // Try company-specific fields first
    const companyName = user.companyName || user.company_name || user.businessName;
    if (companyName) return companyName;
    
    // If it's explicitly a company role
    if (user.role === 'company') {
      return user.name || user.username || user.email || 'Company';
    }
    
    // For creators/other users, show first name or username
    const displayName = user.firstName || user.first_name || user.name || user.username || user.email;
    return displayName || 'User';
  };

  // Helper function to get avatar fallback
  const getAvatarFallback = (user: any) => {
    if (!user) return 'U';
    
    // Try company-specific fields first
    const companyName = user.companyName || user.company_name || user.businessName;
    if (companyName) return companyName[0].toUpperCase();
    
    // Try general name fields
    const name = user.firstName || user.first_name || user.name || user.username || user.email;
    return name ? name[0].toUpperCase() : 'U';
  };

  // Update selected conversation when URL changes
  useEffect(() => {
    if (conversationFromUrl && conversationFromUrl !== selectedConversation) {
      setSelectedConversation(conversationFromUrl);
    }
  }, [conversationFromUrl, selectedConversation]);

  // Initialize notification sound
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvHZhjMICGS56+OcTgwOUKzk7rdkHQc2jdXy0IEsDipu0ObnllkTClGn4u2yaBcGLXjH8N+OSA==');
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  // WebSocket connection (only reconnect on auth changes, not UI state)
// WebSocket connection (only reconnect on auth changes, not UI state)
useEffect(() => {
  if (!isAuthenticated) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // For cloud environments (Codespaces, etc.), use window.location.host directly
  // This includes the forwarded port in the hostname, so we don't add :port again
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  let shouldReconnect = true; // Per-effect reconnect flag
  
  const connectWebSocket = () => {
    try {
      setIsConnecting(true);
      const socket = new WebSocket(wsUrl);
      
      // Rest of your code...
        // Assign immediately so error/close handlers can identify this socket
        wsRef.current = socket;
        
        socket.onopen = () => {
          // Only update state if this socket is still current
          if (socket === wsRef.current) {
            setIsConnecting(false);
            setIsConnected(true);
          }
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'new_message') {
              // Invalidate queries
              if (data.message?.conversationId) {
                queryClient.invalidateQueries({ 
                  queryKey: ["/api/messages", data.message.conversationId] 
                });
              }
              queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
              
              // Play sound - read from current state
              const currentSoundEnabled = localStorage.getItem('messageSoundEnabled');
              const shouldPlaySound = currentSoundEnabled === null ? true : currentSoundEnabled === 'true';
              if (shouldPlaySound && data.message?.senderId !== userIdRef.current && audioRef.current) {
                audioRef.current.play().catch(() => {});
              }
            } else if (data.type === 'user_typing') {
              // Use ref to get current conversation (not stale closure value)
              if (data.conversationId === selectedConversationRef.current) {
                setTypingUsers(prev => new Set(prev).add(data.userId));
              }
            } else if (data.type === 'user_stop_typing') {
              // Only remove typing indicator if it's for the current conversation
              if (data.conversationId === selectedConversationRef.current) {
                setTypingUsers(prev => {
                  const next = new Set(prev);
                  next.delete(data.userId);
                  return next;
                });
              }
            } else if (data.type === 'messages_read') {
              // Invalidate regardless of current conversation
              queryClient.invalidateQueries({ 
                queryKey: ["/api/messages", data.conversationId] 
              });
            }
          } catch (error) {
            console.error('WebSocket message parse error:', error);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Only update state if this socket is still current
          if (socket === wsRef.current) {
            setIsConnecting(false);
            setIsConnected(false);
          }
        };

        socket.onclose = () => {
          // Only handle close if this socket is still the current one
          if (socket === wsRef.current) {
            setIsConnecting(false);
            setIsConnected(false);
            wsRef.current = null;
            
            // Only attempt to reconnect if we should and still authenticated
            if (shouldReconnect) {
              reconnectTimeoutRef.current = setTimeout(() => {
                if (shouldReconnect) {
                  connectWebSocket();
                }
              }, 3000);
            }
          }
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setIsConnecting(false);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      // Disable reconnection for this effect instance
      shouldReconnect = false;
      
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close the socket if it exists
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated]); // Only depend on auth, not UI state

  const { data: conversations } = useQuery<any[]>({
    queryKey: ["/api/conversations"],
    enabled: isAuthenticated,
  });

  // Debug: Log conversations to see the data structure
  useEffect(() => {
    if (conversations && conversations.length > 0) {
      console.log('Conversations data:', conversations);
      console.log('First conversation otherUser:', conversations[0]?.otherUser);
    }
  }, [conversations]);

  const { data: messages = [] } = useQuery<EnhancedMessage[]>({
    queryKey: ["/api/messages", selectedConversation],
    enabled: !!selectedConversation && isAuthenticated,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Mark messages as read when conversation is viewed
  useEffect(() => {
    if (selectedConversation && isConnected && wsRef.current && user?.id) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_read',
        conversationId: selectedConversation,
        userId: user.id,
      }));
    }
  }, [selectedConversation, isConnected, user?.id, messages.length]);

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (!selectedConversation || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Send typing start
    wsRef.current.send(JSON.stringify({
      type: 'typing_start',
      conversationId: selectedConversation,
    }));

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to send typing stop
    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing_stop',
          conversationId: selectedConversation,
        }));
      }
    }, 3000);
  }, [selectedConversation]);

  const sendMessage = async () => {
    if (!selectedConversation || !messageText.trim() || !user?.id) return;

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_stop',
        conversationId: selectedConversation,
      }));
    }

    const messageContent = messageText;
    setMessageText(""); // Clear input immediately for better UX

    // Send via WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        conversationId: selectedConversation,
        senderId: user.id,
        content: messageContent,
      }));

      // Immediately refetch messages after sending
      queryClient.invalidateQueries({
        queryKey: ["/api/messages", selectedConversation]
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations"]
      });
    } else {
      // Restore message if not connected
      setMessageText(messageContent);
      toast({
        title: "Connection Error",
        description: "Real-time messaging is not connected. Trying to reconnect...",
        variant: "destructive",
      });
    }
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('messageSoundEnabled', String(newValue));
    toast({
      title: newValue ? "Sound enabled" : "Sound disabled",
      description: newValue ? "You'll hear a notification for new messages" : "Message sounds are muted",
    });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const shouldShowDateSeparator = (currentMessage: EnhancedMessage, previousMessage: EnhancedMessage | null) => {
    if (!previousMessage) return true;
    return !isSameDay(new Date(currentMessage.createdAt), new Date(previousMessage.createdAt));
  };

  const shouldGroupMessage = (currentMessage: EnhancedMessage, previousMessage: EnhancedMessage | null) => {
    if (!previousMessage) return false;
    if (currentMessage.senderId !== previousMessage.senderId) return false;
    
    const timeDiff = new Date(currentMessage.createdAt).getTime() - new Date(previousMessage.createdAt).getTime();
    return timeDiff < 60000; // Group if within 1 minute
  };

  const otherUser = conversations?.find((c: any) => c.id === selectedConversation)?.otherUser;
  const isOtherUserTyping = typingUsers.size > 0;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="grid md:grid-cols-[320px_1fr] gap-4 h-full">
        {/* Conversations List - Hidden on mobile when conversation is selected */}
        <Card className={`border-card-border ${selectedConversation ? 'hidden md:block' : 'block'}`}>
          <CardContent className="p-0">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg">Messages</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                data-testid="button-toggle-sound"
                className="h-10 w-10"
              >
                {soundEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              {!conversations || conversations.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Apply to offers to start messaging companies
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conversation: any) => (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation.id)}
                      className={`w-full p-4 sm:p-3 text-left hover-elevate transition-colors min-h-[80px] sm:min-h-0 ${
                        selectedConversation === conversation.id ? 'bg-accent' : 'hover:bg-accent/50'
                      }`}
                      data-testid={`conversation-${conversation.id}`}
                    >
                      <div className="flex gap-3 items-start">
                        <Avatar className="h-12 w-12 sm:h-10 sm:w-10 shrink-0">
                          <AvatarImage src={conversation.otherUser?.profileImageUrl} />
                          <AvatarFallback>
                            {getAvatarFallback(conversation.otherUser)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="font-semibold truncate text-base sm:text-sm">
                              {getDisplayName(conversation.otherUser)}
                            </div>
                            <div className="text-xs text-muted-foreground shrink-0">
                              {conversation.lastMessageAt &&
                                formatMessageDate(conversation.lastMessageAt)}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground truncate font-medium">
                            {conversation.offer?.title}
                          </div>
                          {conversation.lastMessage && (
                            <div className="text-sm text-muted-foreground truncate mt-1">
                              {conversation.lastMessage}
                            </div>
                          )}
                        </div>
                        {conversation.unreadCount > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 px-1.5">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages View - Show on mobile when conversation selected */}
        <Card className={`border-card-border flex flex-col ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Select a conversation to start messaging</p>
                <p className="text-sm text-muted-foreground mt-2">
                  All your conversations about affiliate offers appear here
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header with back button on mobile */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Back button for mobile */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedConversation(null)}
                      className="md:hidden h-10 w-10 shrink-0"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={otherUser?.profileImageUrl} />
                      <AvatarFallback>
                        {getAvatarFallback(otherUser)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">
                        {getDisplayName(otherUser)}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {conversations?.find((c: any) => c.id === selectedConversation)?.offer?.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnecting && (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Connecting
                      </Badge>
                    )}
                    {!isConnecting && !isConnected && (
                      <Badge variant="destructive" className="gap-1">
                        <WifiOff className="h-3 w-3" />
                        Offline
                      </Badge>
                    )}
                    {!isConnecting && isConnected && (
                      <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        Online
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages?.map((message, index) => {
                    const previousMessage = index > 0 ? messages[index - 1] : null;
                    const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
                    const groupWithPrevious = shouldGroupMessage(message, previousMessage);
                    const isOwnMessage = message.senderId === user?.id;

                    return (
                      <div key={message.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <Badge variant="secondary" className="text-xs">
                              {formatDateSeparator(message.createdAt)}
                            </Badge>
                          </div>
                        )}
                        <div
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
                            groupWithPrevious ? 'mt-1' : 'mt-4'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                              isOwnMessage
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <p className="text-xs opacity-70">
                                {format(new Date(message.createdAt), 'h:mm a')}
                              </p>
                              {isOwnMessage && (
                                <span className="opacity-70">
                                  {message.isRead ? (
                                    <CheckCheck className="h-3 w-3" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Typing Indicator */}
                  {isOtherUserTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Input - Better mobile touch targets */}
              <div className="p-3 sm:p-4 border-t bg-background">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    data-testid="button-attach-image"
                    disabled
                    className="h-11 w-11 shrink-0"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                  <Input
                    ref={messageInputRef}
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={!isConnected && !isConnecting}
                    data-testid="input-message"
                    className="h-11 text-base"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!messageText.trim() || !isConnected}
                    data-testid="button-send-message"
                    className="h-11 w-11 sm:w-auto sm:px-4 shrink-0"
                  >
                    <Send className="h-5 w-5" />
                    <span className="hidden sm:inline ml-2">Send</span>
                  </Button>
                </div>
                {!isConnected && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {isConnecting ? "Connecting to chat server..." : "Reconnecting to chat server..."}
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}