"use client";
import { useState, useEffect, useRef } from "react";

import {
  Badge,
  Card,
  CoreButton,
  Input,
  Label,
  Textarea,
} from "@/shared/components/ui";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

interface SSEMessage {
  id: string;
  event?: string;
  data: unknown;
  timestamp: string;
}

interface ConnectionStats {
  isConnected: boolean;
  clientId?: string;
  messageCount: number;
  lastHeartbeat?: string;
  connectionTime?: string;
}

const SSE: React.FC = () => {
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const [stats, setStats] = useState<ConnectionStats>({
    isConnected: false,
    messageCount: 0,
  });
  const [testMessage, setTestMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [sessionId, setSessionId] = useState("");

  const maxMessages = 50;
  const eventSourceRef = useRef<EventSource | null>(null);

  const safeJSONParse = (data: string): unknown => {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  };

  const connect = () => {
    if (eventSourceRef.current) {
      disconnect();
    }

    const params = new URLSearchParams();
    if (userId.trim()) params.append("userId", userId.trim());
    if (sessionId.trim()) params.append("sessionId", sessionId.trim());

    const url = `/api/sse?${params.toString()}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setStats((prev) => ({
        ...prev,
        isConnected: true,
        connectionTime: new Date().toLocaleTimeString(),
      }));
    };

    eventSource.onmessage = (event) => {
      handleMessage("message", event);
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      setStats((prev) => ({ ...prev, isConnected: false }));
      eventSource.close();
    };

    eventSource.addEventListener("connected", (event) => {
      handleMessage("connected", event);
      const data = safeJSONParse(event.data) as { clientId?: string };
      setStats((prev) => ({ ...prev, clientId: data.clientId }));
    });

    eventSource.addEventListener("heartbeat", (event) => {
      handleMessage("heartbeat", event);
      const data = safeJSONParse(event.data) as { timestamp?: string };
      if (data.timestamp) {
        setStats((prev) => ({ ...prev, lastHeartbeat: data.timestamp }));
      }
    });

    [
      "system.message",
      "user.message",
      "content.created",
      "media.ready",
      "job.completed",
      "webhook.received",
    ].forEach((eventType) => {
      eventSource.addEventListener(eventType, (event) => {
        handleMessage(eventType, event);
      });
    });

    eventSourceRef.current = eventSource;
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setStats((prev) => ({
        ...prev,
        isConnected: false,
        clientId: undefined,
        lastHeartbeat: undefined,
      }));
      console.log("SSE disconnected");
    }
  };

  const handleMessage = (eventType: string, event: MessageEvent) => {
    const data = safeJSONParse(event.data);

    const message: SSEMessage = {
      id: event.lastEventId || Date.now().toString(),
      event: eventType,
      data,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => {
      const updated = [message, ...prev].slice(0, maxMessages);
      return updated;
    });

    setStats((prev) => ({
      ...prev,
      messageCount: prev.messageCount + 1,
    }));
  };

  const sendTestMessage = async () => {
    if (!testMessage.trim()) return;

    try {
      const response = await fetch("/api/sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "system.message",
          message: testMessage,
          userId: userId.trim() || undefined,
          sessionId: sessionId.trim() || undefined,
        }),
      });

      if (response.ok) {
        setTestMessage("");
      } else {
        console.error("Failed to send test message", response);
      }
    } catch (error) {
      console.error("Error sending test message:", error);
    }
  };

  const sendBroadcast = async () => {
    try {
      await fetch("/api/sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "system.message",
          message: "Broadcast test message to all clients",
          broadcast: true,
        }),
      });
    } catch (error) {
      console.error("Error sending broadcast:", error);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setStats((prev) => ({ ...prev, messageCount: 0 }));
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="w-4xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>SSE Interface</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-48 flex-1">
              <Label htmlFor="userId">User ID (optional)</Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user ID"
                disabled={stats.isConnected}
              />
            </div>
            <div className="min-w-48 flex-1">
              <Label htmlFor="sessionId">Session ID (optional)</Label>
              <Input
                id="sessionId"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Enter session ID"
                disabled={stats.isConnected}
              />
            </div>
            <div className="flex gap-2">
              <CoreButton
                onClick={connect}
                disabled={stats.isConnected}
                variant="default"
              >
                Connect
              </CoreButton>
              <CoreButton
                onClick={disconnect}
                disabled={!stats.isConnected}
                variant="destructive"
              >
                Disconnect
              </CoreButton>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <span className="font-medium text-black">Status:</span>
              <Badge variant={stats.isConnected ? "default" : "secondary"}>
                {stats.isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            {stats.clientId && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-black">Client ID:</span>
                <code className="rounded bg-gray-200 px-2 py-1 text-sm text-blue-800">
                  {stats.clientId.slice(0, 8)}...
                </code>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-medium text-black">Messages:</span>
              <Badge variant="outline">{stats.messageCount}</Badge>
            </div>
            {stats.connectionTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-black">Connected at:</span>
                <span className="text-sm text-gray-600">
                  {stats.connectionTime}
                </span>
              </div>
            )}
            {stats.lastHeartbeat && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-black">Last heartbeat:</span>
                <span className="text-sm text-gray-600">
                  {new Date(stats.lastHeartbeat).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-medium text-black">Send Test Messages</h3>
            <div className="flex gap-2">
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter test message..."
                className="flex-1"
                rows={2}
              />
              <div className="flex flex-col gap-2">
                <CoreButton
                  onClick={sendTestMessage}
                  disabled={!testMessage.trim()}
                >
                  Send to Target
                </CoreButton>
                <CoreButton onClick={sendBroadcast} variant="outline">
                  Broadcast
                </CoreButton>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Received Messages</CardTitle>
          <CoreButton onClick={clearMessages} variant="outline" size="sm">
            Clear
          </CoreButton>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              No messages received yet. Connect and send some test messages!
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={`${message.id}-${index}`}
                  className="rounded-lg border bg-gray-50 p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          message.event === "heartbeat"
                            ? "secondary"
                            : "default"
                        }
                        className="text-xs"
                      >
                        {message.event ?? "message"}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {message.timestamp}
                      </span>
                    </div>
                    {message.id && (
                      <code className="text-xs text-gray-400">
                        {message.id.slice(0, 8)}
                      </code>
                    )}
                  </div>
                  <pre className="overflow-x-auto text-sm whitespace-pre-wrap text-gray-700">
                    {typeof message.data === "string"
                      ? message.data
                      : JSON.stringify(message.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SSE;
