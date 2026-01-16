"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Circle,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Trash2,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  Database,
  FileJson,
  Save,
  FolderOpen,
} from "lucide-react";
import { TimelineSlider } from "./TimelineSlider";
import { StateInspector } from "./StateInspector";
import { RecordingStorage, type RecordingSession, type DebugEvent } from "./RecordingStorage";

export interface TimeTravelDebuggerProps {
  connectionId: string;
  streamName?: string;
  ruleName?: string;
}

type RecordingState = "idle" | "recording" | "playing" | "paused";

export function TimeTravelDebugger({
  connectionId,
  streamName,
  ruleName,
}: TimeTravelDebuggerProps) {
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<RecordingSession[]>([]);
  const [sessionName, setSessionName] = useState("");

  // Playback state
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved sessions on mount
  useEffect(() => {
    loadSavedSessions();
  }, []);

  const loadSavedSessions = async () => {
    const sessions = await RecordingStorage.getAllSessions();
    setSavedSessions(sessions);
  };

  // Start recording
  const startRecording = useCallback(() => {
    const session: RecordingSession = {
      id: `session-${Date.now()}`,
      name: sessionName || `Recording ${new Date().toLocaleString()}`,
      streamName: streamName || "",
      ruleName: ruleName || "",
      startTime: new Date(),
      events: [],
      status: "recording",
    };
    setCurrentSession(session);
    setRecordingState("recording");
    setCurrentEventIndex(0);

    // Simulate receiving events (in production, connect to WebSocket)
    simulateEvents(session);
  }, [sessionName, streamName, ruleName]);

  // Simulate events for demo
  const simulateEvents = (session: RecordingSession) => {
    let eventIndex = 0;
    const interval = setInterval(() => {
      if (recordingState !== "recording") {
        clearInterval(interval);
        return;
      }

      const event: DebugEvent = {
        id: `event-${eventIndex}`,
        timestamp: new Date(),
        type: ["input", "processing", "output"][eventIndex % 3] as DebugEvent["type"],
        data: {
          temperature: 20 + Math.random() * 15,
          humidity: 40 + Math.random() * 40,
          value: Math.floor(Math.random() * 100),
        },
        state: {
          recordsProcessed: eventIndex + 1,
          lastValue: Math.random() * 100,
          windowStart: new Date(Date.now() - 60000).toISOString(),
        },
        metadata: {
          processingTime: Math.random() * 50,
          memoryUsage: Math.random() * 100,
        },
      };

      session.events.push(event);
      setCurrentSession({ ...session });
      eventIndex++;

      // Stop after 50 events for demo
      if (eventIndex >= 50) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  };

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (currentSession) {
      const updatedSession = {
        ...currentSession,
        endTime: new Date(),
        status: "stopped" as const,
      };
      setCurrentSession(updatedSession);
      setRecordingState("idle");

      // Save to IndexedDB
      await RecordingStorage.saveSession(updatedSession);
      await loadSavedSessions();
    }
  }, [currentSession]);

  // Start playback
  const startPlayback = useCallback(() => {
    if (!currentSession || currentSession.events.length === 0) return;

    setRecordingState("playing");

    const eventDuration = 1000 / playbackSpeed;
    playbackIntervalRef.current = setInterval(() => {
      setCurrentEventIndex((prev) => {
        if (prev >= currentSession.events.length - 1) {
          if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
          }
          setRecordingState("paused");
          return prev;
        }
        return prev + 1;
      });
    }, eventDuration);
  }, [currentSession, playbackSpeed]);

  // Pause playback
  const pausePlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
    setRecordingState("paused");
  }, []);

  // Step forward/backward
  const stepForward = useCallback(() => {
    if (!currentSession) return;
    setCurrentEventIndex((prev) =>
      Math.min(prev + 1, currentSession.events.length - 1)
    );
  }, [currentSession]);

  const stepBackward = useCallback(() => {
    setCurrentEventIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Jump to start/end
  const jumpToStart = useCallback(() => {
    setCurrentEventIndex(0);
  }, []);

  const jumpToEnd = useCallback(() => {
    if (!currentSession) return;
    setCurrentEventIndex(currentSession.events.length - 1);
  }, [currentSession]);

  // Load session
  const loadSession = useCallback(async (sessionId: string) => {
    const session = await RecordingStorage.getSession(sessionId);
    if (session) {
      setCurrentSession(session);
      setRecordingState("paused");
      setCurrentEventIndex(0);
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    await RecordingStorage.deleteSession(sessionId);
    await loadSavedSessions();
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
      setRecordingState("idle");
    }
  }, [currentSession]);

  // Export session
  const exportSession = useCallback(() => {
    if (!currentSession) return;
    const blob = new Blob([JSON.stringify(currentSession, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-session-${currentSession.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentSession]);

  // Import session
  const importSession = useCallback(async (file: File) => {
    const text = await file.text();
    const session = JSON.parse(text) as RecordingSession;
    session.id = `imported-${Date.now()}`;
    session.startTime = new Date(session.startTime);
    if (session.endTime) session.endTime = new Date(session.endTime);
    session.events = session.events.map((e) => ({
      ...e,
      timestamp: new Date(e.timestamp),
    }));
    await RecordingStorage.saveSession(session);
    await loadSavedSessions();
    setCurrentSession(session);
    setRecordingState("paused");
    setCurrentEventIndex(0);
  }, []);

  // Current event
  const currentEvent = currentSession?.events[currentEventIndex];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-sota-blue" />
                Time-Travel Debugger
              </CardTitle>
              <Badge
                variant={
                  recordingState === "recording"
                    ? "destructive"
                    : recordingState === "playing"
                    ? "default"
                    : "secondary"
                }
              >
                {recordingState === "recording" && (
                  <Circle className="h-2 w-2 mr-1 fill-current animate-pulse" />
                )}
                {recordingState.charAt(0).toUpperCase() + recordingState.slice(1)}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Recording controls */}
              {recordingState === "idle" && (
                <>
                  <Input
                    placeholder="Session name"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="w-48"
                  />
                  <Button onClick={startRecording}>
                    <Circle className="h-4 w-4 mr-2 fill-red-500 text-red-500" />
                    Record
                  </Button>
                </>
              )}

              {recordingState === "recording" && (
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}

              {/* Load/Save dialogs */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Saved Sessions</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-64">
                    {savedSessions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No saved sessions
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {savedSessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between p-3 border rounded hover:bg-muted/50"
                          >
                            <div>
                              <p className="font-medium">{session.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {session.events.length} events •{" "}
                                {new Date(session.startTime).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => loadSession(session.id)}
                              >
                                Load
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteSession(session.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              {currentSession && (
                <>
                  <Button variant="outline" size="icon" onClick={exportSession}>
                    <Download className="h-4 w-4" />
                  </Button>
                </>
              )}

              <label>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importSession(file);
                  }}
                />
                <Button variant="outline" size="icon" asChild>
                  <span>
                    <Upload className="h-4 w-4" />
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main content */}
      {currentSession ? (
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          {/* Timeline and controls */}
          <Card className="col-span-2 flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Event Timeline</CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Speed:</Label>
                  <Select
                    value={String(playbackSpeed)}
                    onValueChange={(v) => setPlaybackSpeed(Number(v))}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">0.5x</SelectItem>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                      <SelectItem value="5">5x</SelectItem>
                      <SelectItem value="10">10x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Playback controls */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <Button variant="outline" size="icon" onClick={jumpToStart}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={stepBackward}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {recordingState === "playing" ? (
                  <Button size="icon" onClick={pausePlayback}>
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={startPlayback}
                    disabled={recordingState === "recording"}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}

                <Button variant="outline" size="icon" onClick={stepForward}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={jumpToEnd}>
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              {/* Timeline slider */}
              <TimelineSlider
                events={currentSession.events}
                currentIndex={currentEventIndex}
                onIndexChange={setCurrentEventIndex}
              />

              {/* Event list */}
              <div className="flex-1 mt-4 min-h-0">
                <ScrollArea className="h-full">
                  <div className="space-y-1">
                    {currentSession.events.map((event, index) => (
                      <div
                        key={event.id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                          index === currentEventIndex
                            ? "bg-sota-blue/20 border border-sota-blue"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setCurrentEventIndex(index)}
                      >
                        <span className="text-xs text-muted-foreground w-8">
                          #{index + 1}
                        </span>
                        <Badge
                          variant={
                            event.type === "input"
                              ? "default"
                              : event.type === "output"
                              ? "secondary"
                              : event.type === "error"
                              ? "destructive"
                              : "outline"
                          }
                          className="w-20 justify-center"
                        >
                          {event.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                        <code className="text-xs flex-1 truncate">
                          {JSON.stringify(event.data).slice(0, 50)}...
                        </code>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* State inspector */}
          <StateInspector event={currentEvent} />
        </div>
      ) : (
        <Card className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Active Session</h3>
            <p className="text-sm mb-4">
              Start a new recording or load a saved session to begin debugging
            </p>
            <Button onClick={startRecording}>
              <Circle className="h-4 w-4 mr-2 fill-red-500 text-red-500" />
              Start Recording
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
