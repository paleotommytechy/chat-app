"use client";

import Image from "next/image";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Download,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Image as ImageIcon,
  LockKeyhole,
  LogOut,
  Mail,
  Mic,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { decryptSensitiveFile, encryptSensitiveFile, isSensitiveEnvFile } from "@/lib/crypto";

type Channel = "general" | "screenshots" | "files";

type Message = {
  _id: string;
  sender: string;
  senderUserId?: string;
  channel?: Channel;
  kind: "text" | "file" | "voice";
  text?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  encrypted?: boolean;
  fileUrl?: string | null;
  durationMs?: number;
  createdAt: number;
};

const api = anyApi;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_SCREENSHOT_SIZE = 8 * 1024 * 1024;
const MAX_VOICE_SIZE = 6 * 1024 * 1024;
const MAX_VOICE_SECONDS = 5 * 60;

function makeSessionToken() {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function formatDuration(milliseconds = 0) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function supportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function friendlyAuthError(error: unknown, mode: "signin" | "signup") {
  const raw = error instanceof Error ? error.message : "";
  const message = raw.toLowerCase();

  if (message.includes("incorrect email or password")) {
    return {
      message: "Check your email and password, then try again.",
      credentialError: true,
      title: "Email or password doesn't match",
    };
  }

  if (message.includes("account already exists")) {
    return {
      message: "An account already exists with this email. Sign in instead.",
      credentialError: false,
      title: "Account already exists",
    };
  }

  if (message.includes("valid email")) {
    return {
      message: "Enter a valid email address.",
      credentialError: false,
      title: "Check your email address",
    };
  }

  if (message.includes("password must be between")) {
    return {
      message: "Use a password with at least 8 characters.",
      credentialError: false,
      title: "Password is too short",
    };
  }

  if (message.includes("name between")) {
    return {
      message: "Use a name between 2 and 40 characters.",
      credentialError: false,
      title: "Check your name",
    };
  }

  if (
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch")
  ) {
    return {
      message: "Check your internet connection and try again.",
      credentialError: false,
      title: "Syncret couldn't connect",
    };
  }

  return {
    message:
      mode === "signin"
        ? "We couldn't sign you in right now. Please try again."
        : "We couldn't create your account right now. Please try again.",
    credentialError: false,
    title: mode === "signin" ? "Sign in failed" : "Account creation failed",
  };
}

export function Syncret() {
  const signup = useMutation(api.auth.signup);
  const login = useMutation(api.auth.login);
  const logoutMutation = useMutation(api.auth.logout);
  const sendText = useMutation(api.messages.sendText);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendFile = useMutation(api.messages.sendFile);
  const sendVoice = useMutation(api.messages.sendVoice);
  const deleteMessage = useMutation(api.messages.deleteMessage);

  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [loginErrorTitle, setLoginErrorTitle] = useState("");
  const [credentialError, setCredentialError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [channel, setChannel] = useState<Channel>("general");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Message | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);

  useEffect(() => {
    const local = window.localStorage.getItem("syncret-session-token");
    const sessionOnly = window.sessionStorage.getItem("syncret-session-token");
    const legacyPersistentToken = window.localStorage.getItem("devcache-session-token");
    const legacySessionToken = window.sessionStorage.getItem("devcache-session-token");
    const olderLegacyToken = window.localStorage.getItem("friendspace-session-token");
    const saved =
      local ??
      sessionOnly ??
      legacyPersistentToken ??
      legacySessionToken ??
      olderLegacyToken;

    if (!saved) return;

    setToken(saved);

    if (!local && !sessionOnly) {
      if (legacySessionToken) {
        window.sessionStorage.setItem("syncret-session-token", saved);
      } else {
        window.localStorage.setItem("syncret-session-token", saved);
      }
    }

    window.localStorage.removeItem("devcache-session-token");
    window.sessionStorage.removeItem("devcache-session-token");
    window.localStorage.removeItem("friendspace-session-token");
  }, []);

  const session = useQuery(api.auth.session, token ? { token } : "skip");
  const messages = useQuery(
    api.messages.list,
    token && session ? { token, channel } : "skip",
  ) as Message[] | undefined;
  const fileEncryptionKey = useQuery(
    api.auth.fileEncryptionKey,
    token && session ? { token } : "skip",
  ) as string | null | undefined;

  useEffect(() => {
    if (messages?.length) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, channel]);

  useEffect(() => {
    if (channel !== "screenshots" || !token) return;

    const handleWindowPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      const image = files.find((file) => file.type.startsWith("image/"));
      if (!image) return;
      event.preventDefault();
      void uploadSharedFile(image, "screenshots");
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [channel, token, uploading, fileEncryptionKey]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!pendingDelete) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => deleteCancelRef.current?.focus());

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !deletingId) {
        setPendingDelete(null);
        setDeleteError("");
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = deleteDialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingDelete, deletingId]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    setLoginErrorTitle("");
    setCredentialError(false);
    setIsLoggingIn(true);
    try {
      const nextToken = makeSessionToken();
      if (authMode === "signup") {
        await signup({ displayName, email, password, token: nextToken });
      } else {
        await login({ email, password, token: nextToken });
      }

      window.localStorage.removeItem("syncret-session-token");
      window.sessionStorage.removeItem("syncret-session-token");
      const storage = rememberMe ? window.localStorage : window.sessionStorage;
      storage.setItem("syncret-session-token", nextToken);
      setToken(nextToken);
      setPassword("");
    } catch (error) {
      const friendly = friendlyAuthError(error, authMode);
      setLoginError(friendly.message);
      setLoginErrorTitle(friendly.title);
      setCredentialError(friendly.credentialError);

      if (friendly.credentialError) {
        window.requestAnimationFrame(() => {
          passwordInputRef.current?.focus();
          passwordInputRef.current?.select();
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    if (isRecording) cancelRecording();

    if (token) {
      try {
        await logoutMutation({ token });
      } catch {
        // Local sign-out still proceeds if the network is unavailable.
      }
    }

    window.localStorage.removeItem("syncret-session-token");
    window.sessionStorage.removeItem("syncret-session-token");
    window.localStorage.removeItem("devcache-session-token");
    window.sessionStorage.removeItem("devcache-session-token");
    window.localStorage.removeItem("friendspace-session-token");
    setToken(null);
  }

  async function handleSend() {
    if (!token || channel !== "general" || !text.trim()) return;
    const body = text;
    setText("");

    try {
      await sendText({ token, text: body });
    } catch (error) {
      setText(body);
      setStatus(error instanceof Error ? error.message : "Message failed to send.");
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  async function uploadSharedFile(file: File, targetChannel: "screenshots" | "files" = channel as "screenshots" | "files") {
    if (!token || uploading) return;

    if (targetChannel === "screenshots") {
      if (!file.type.startsWith("image/")) {
        setStatus("Screenshots only accepts image files.");
        return;
      }
      if (file.size > MAX_SCREENSHOT_SIZE) {
        setStatus("Screenshots are limited to 8 MB.");
        return;
      }
    } else {
      if (file.type.startsWith("image/")) {
        setStatus("Images belong in Screenshots, not Files.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setStatus("Files are limited to 10 MB.");
        return;
      }
    }

    setStatus("");
    setUploading(true);

    try {
      const encrypted = targetChannel === "files" && isSensitiveEnvFile(file.name);
      let uploadBody: Blob | File = file;

      if (encrypted) {
        if (!fileEncryptionKey) {
          throw new Error("Encrypted .env sharing is not configured yet.");
        }
        uploadBody = await encryptSensitiveFile(file, fileEncryptionKey);
      }

      const uploadUrl = await generateUploadUrl({ token });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": uploadBody.type || "application/octet-stream" },
        body: uploadBody,
      });

      if (!response.ok) throw new Error("The upload failed.");
      const { storageId } = (await response.json()) as { storageId: string };

      await sendFile({
        token,
        channel: targetChannel,
        storageId: storageId as never,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        encrypted,
      });

      setStatus(
        targetChannel === "screenshots"
          ? "Screenshot shared."
          : encrypted
            ? "Encrypted .env file shared safely."
            : "File shared.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function uploadVoiceNote(blob: Blob, durationMs: number) {
    if (!token) return;
    if (blob.size > MAX_VOICE_SIZE) {
      setStatus("Voice note is too large. Keep recordings under 5 minutes.");
      return;
    }

    setUploading(true);
    setStatus("");

    try {
      const uploadUrl = await generateUploadUrl({ token });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });

      if (!response.ok) throw new Error("Voice note upload failed.");
      const { storageId } = (await response.json()) as { storageId: string };

      await sendVoice({
        token,
        storageId: storageId as never,
        fileSize: blob.size,
        mimeType: blob.type || "audio/webm",
        durationMs,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Voice note failed to send.");
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    if (!token || channel !== "general" || isRecording || uploading) return;

    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = supportedAudioMimeType();
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);

      voiceChunksRef.current = [];
      discardRecordingRef.current = false;
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setStatus("");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const durationMs = Math.max(1000, Date.now() - recordingStartedAtRef.current);
        const shouldDiscard = discardRecordingRef.current;
        const chunks = [...voiceChunksRef.current];
        const mimeType = recorder.mimeType || preferredType || "audio/webm";

        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        voiceChunksRef.current = [];
        setIsRecording(false);
        setRecordingSeconds(0);

        if (shouldDiscard || chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mimeType });
        void uploadVoiceNote(blob, durationMs);
      };

      recorder.start(250);
      setIsRecording(true);

      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setRecordingSeconds(elapsed);

        if (elapsed >= MAX_VOICE_SECONDS && recorder.state !== "inactive") {
          recorder.stop();
        }
      }, 250);
    } catch (error) {
      setStatus(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access and try again."
          : "Could not start the microphone.",
      );
    }
  }

  function stopRecording() {
    discardRecordingRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function cancelRecording() {
    discardRecordingRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function downloadFile(message: Message) {
    if (!message.fileUrl || !message.fileName) return;
    setStatus("");

    try {
      const response = await fetch(message.fileUrl);
      if (!response.ok) throw new Error("Could not download this file.");
      const payload = await response.arrayBuffer();
      let blob = new Blob([payload], {
        type: message.mimeType || "application/octet-stream",
      });

      if (message.encrypted) {
        if (!fileEncryptionKey) {
          throw new Error("Encrypted .env sharing is not configured yet.");
        }
        blob = await decryptSensitiveFile(
          payload,
          fileEncryptionKey,
          message.mimeType || "text/plain",
        );
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = message.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Download failed.");
    }
  }

  function requestDelete(message: Message) {
    if (deletingId) return;
    setDeleteError("");
    setPendingDelete(message);
  }

  function closeDeleteDialog() {
    if (deletingId) return;
    setPendingDelete(null);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!token || !pendingDelete || deletingId) return;

    setDeletingId(pendingDelete._id);
    setDeleteError("");
    setStatus("");

    try {
      await deleteMessage({
        token,
        messageId: pendingDelete._id as never,
      });
      setPendingDelete(null);
    } catch {
      setDeleteError("Syncret couldn't delete this item. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (channel === "general") {
      setStatus("General is for text and voice notes. Use Screenshots or Files to share uploads.");
      return;
    }

    void uploadSharedFile(file, channel);
  }

  function selectChannel(nextChannel: Channel) {
    if (isRecording) cancelRecording();
    setChannel(nextChannel);
    setStatus("");
    setDragging(false);
  }

  if (!token || session === null) {
    const signingUp = authMode === "signup";

    return (
      <main className="login-shell syncret-auth">
        <div className="auth-orb auth-orb-one" aria-hidden="true" />
        <div className="auth-orb auth-orb-two" aria-hidden="true" />
        <div className="auth-orb auth-orb-three" aria-hidden="true" />

        <section className="login-card syncret-login-card">
          <div className="syncret-logo-wrap">
            <Image
              src="/syncret-logo.svg"
              alt="Syncret encrypted developer workspace"
              width={142}
              height={142}
              priority
              className="syncret-logo"
            />
          </div>

          <div className="syncret-wordmark" aria-label="Syncret">
            <span>Syn</span><strong>cret</strong>
          </div>

          <div className="login-copy">
            <h1>{signingUp ? "Create Account" : "Welcome Back"}</h1>
            <p>{signingUp ? "Create your private developer workspace" : "Sign in to continue"}</p>
          </div>

          <form className="login-form neo-login-form" onSubmit={handleLogin}>
            {signingUp && (
              <label className="neo-field">
                <UserRound size={21} />
                <input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (loginError) {
                      setLoginError("");
                      setLoginErrorTitle("");
                      setCredentialError(false);
                    }
                  }}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label className={`neo-field ${credentialError ? "field-error" : ""}`}>
              <Mail size={21} />
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (loginError) {
                    setLoginError("");
                    setLoginErrorTitle("");
                    setCredentialError(false);
                  }
                }}
                type="email"
                placeholder="Email"
                autoComplete="email"
                aria-invalid={credentialError || undefined}
                aria-describedby={loginError ? "auth-error" : undefined}
                required
              />
            </label>

            <label className={`neo-field ${credentialError ? "field-error" : ""}`}>
              <LockKeyhole size={21} />
              <input
                ref={passwordInputRef}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (loginError) {
                    setLoginError("");
                    setLoginErrorTitle("");
                    setCredentialError(false);
                  }
                }}
                type={showPassword ? "text" : "password"}
                placeholder={signingUp ? "Password · at least 8 characters" : "Password"}
                autoComplete={signingUp ? "new-password" : "current-password"}
                minLength={8}
                aria-invalid={credentialError || undefined}
                aria-describedby={loginError ? "auth-error" : undefined}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </label>

            {!signingUp && (
              <div className="remember-row">
                <button
                  type="button"
                  className={`remember-box ${rememberMe ? "checked" : ""}`}
                  onClick={() => setRememberMe((value) => !value)}
                  aria-pressed={rememberMe}
                >
                  {rememberMe && <Check size={16} strokeWidth={3} />}
                </button>
                <span>Remember Me</span>
              </div>
            )}

            {loginError && (
              <div
                id="auth-error"
                className={`error-note auth-error-note ${credentialError ? "credentials-error" : ""}`}
                role="alert"
                aria-live="assertive"
              >
                <CircleAlert size={18} />
                <div>
                  <strong>{loginErrorTitle}</strong>
                  <span>{loginError}</span>
                  {credentialError && <small>Passwords are case-sensitive.</small>}
                </div>
              </div>
            )}

            <button className="primary-button neo-primary-button" type="submit" disabled={isLoggingIn}>
              <span>{isLoggingIn ? "Please wait…" : signingUp ? "Create Account" : "Login"}</span>
              <span className="login-arrow"><ArrowRight size={22} /></span>
            </button>
          </form>

          <div className="auth-alternative">
            <span />
            <p>
              {signingUp ? "Already have an account?" : "New here?"}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(signingUp ? "signin" : "signup");
                  setLoginError("");
                  setLoginErrorTitle("");
                  setCredentialError(false);
                  setPassword("");
                }}
              >
                {signingUp ? "Sign in" : "Create an account"}
              </button>
            </p>
            <span />
          </div>

          <div className="login-footnote syncret-footnote">
            <ShieldCheck size={18} />
            <div>
              <strong>Secure collaboration for developers</strong>
              <span>Share messages, screenshots and encrypted files safely together.</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (session === undefined) {
    return (
      <main className="loading-screen">
        <div className="pulse-logo">
          <Image src="/syncret-logo.svg" alt="" width={38} height={38} />
        </div>
        <p>Opening Syncret…</p>
      </main>
    );
  }

  const currentName = session.displayName;
  const deleteTargetType = pendingDelete
    ? pendingDelete.kind === "voice"
      ? "voice note"
      : pendingDelete.kind === "file"
        ? (pendingDelete.channel ?? channel) === "screenshots"
          ? "screenshot"
          : "file"
        : "message"
    : "item";

  const deleteTargetTitle = pendingDelete
    ? deleteTargetType === "message"
      ? "Delete message?"
      : deleteTargetType === "voice note"
        ? "Delete voice note?"
        : deleteTargetType === "screenshot"
          ? "Delete screenshot?"
          : "Delete file?"
    : "";

  const deleteTargetPreview = pendingDelete
    ? pendingDelete.kind === "text"
      ? pendingDelete.text?.trim() || "Empty message"
      : pendingDelete.kind === "voice"
        ? `Voice note · ${formatDuration(pendingDelete.durationMs)}`
        : pendingDelete.fileName ||
          (deleteTargetType === "screenshot" ? "Screenshot" : "Shared file")
    : "";

  const channelMeta = {
    general: {
      title: "# general",
      subtitle: "Conversation and voice notes only",
      emptyTitle: "Start the conversation",
      emptyText: "Send a message or record a voice note. Files stay in Files, and images stay in Screenshots.",
      icon: <Users size={26} />,
    },
    screenshots: {
      title: "# screenshots",
      subtitle: "Images for bugs, UI issues and visual context",
      emptyTitle: "No screenshots yet",
      emptyText: "Upload, drag or paste an image here when you need to show what is happening on screen.",
      icon: <ImageIcon size={26} />,
    },
    files: {
      title: "# files",
      subtitle: "Small project, config and environment files",
      emptyTitle: "No files yet",
      emptyText: "Share small files like .env, AGENTS.md, configs, snippets and documents here.",
      icon: <FileText size={26} />,
    },
  }[channel];

  return (
    <main
      className={`workspace ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        if (channel === "general") return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {dragging && channel !== "general" && (
        <div className="drop-overlay">
          <UploadCloud size={34} />
          <strong>{channel === "screenshots" ? "Drop screenshot" : "Drop file"}</strong>
          <span>
            {channel === "screenshots"
              ? "Images only · up to 8 MB"
              : "Small files · up to 10 MB"}
          </span>
        </div>
      )}

      {pendingDelete && (
        <div
          className="delete-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteDialog();
          }}
        >
          <section
            ref={deleteDialogRef}
            className="delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
          >
            <button
              type="button"
              className="delete-dialog-close"
              onClick={closeDeleteDialog}
              disabled={Boolean(deletingId)}
              aria-label="Close delete confirmation"
            >
              <X size={18} />
            </button>

            <div className="delete-dialog-icon" aria-hidden="true">
              {deleteTargetType === "screenshot" ? (
                <ImageIcon size={24} />
              ) : deleteTargetType === "file" ? (
                <FileText size={24} />
              ) : deleteTargetType === "voice note" ? (
                <Mic size={24} />
              ) : (
                <Trash2 size={24} />
              )}
            </div>

            <div className="delete-dialog-copy">
              <span className="delete-dialog-eyebrow">Permanent action</span>
              <h3 id="delete-dialog-title">{deleteTargetTitle}</h3>
              <p id="delete-dialog-description">
                This {deleteTargetType} will be permanently removed from Syncret for everyone.
              </p>
            </div>

            <div className="delete-dialog-preview">
              <div className="delete-preview-icon" aria-hidden="true">
                {deleteTargetType === "screenshot" ? (
                  <ImageIcon size={17} />
                ) : deleteTargetType === "file" ? (
                  <FileText size={17} />
                ) : deleteTargetType === "voice note" ? (
                  <Mic size={17} />
                ) : (
                  <Hash size={17} />
                )}
              </div>
              <div>
                <strong>{deleteTargetType}</strong>
                <span>{deleteTargetPreview}</span>
              </div>
            </div>

            <div className="delete-dialog-warning">
              <Trash2 size={15} />
              <span>This action cannot be undone.</span>
            </div>

            {deleteError && (
              <div className="delete-dialog-error" role="alert">
                {deleteError}
              </div>
            )}

            <div className="delete-dialog-actions">
              <button
                ref={deleteCancelRef}
                type="button"
                className="delete-dialog-cancel"
                onClick={closeDeleteDialog}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-dialog-confirm"
                onClick={() => void confirmDelete()}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? (
                  <>
                    <span className="delete-spinner" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete {deleteTargetType}
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark small">
            <Image src="/syncret-logo.svg" alt="" width={30} height={30} />
          </span>
          <div>
            <strong>Syncret</strong>
            <small>private workspace</small>
          </div>
        </div>

        <nav className="nav-group" aria-label="Syncret spaces">
          <span className="nav-label">Spaces</span>
          <button
            className={channel === "general" ? "active" : ""}
            onClick={() => selectChannel("general")}
          >
            <Hash size={17} /><span>general</span>
          </button>
          <button
            className={channel === "screenshots" ? "active" : ""}
            onClick={() => selectChannel("screenshots")}
          >
            <ImageIcon size={17} /><span>screenshots</span>
          </button>
          <button
            className={channel === "files" ? "active" : ""}
            onClick={() => selectChannel("files")}
          >
            <FileText size={17} /><span>files</span>
          </button>
        </nav>

        <div className="security-card">
          <ShieldCheck size={18} />
          <div>
            <strong>Protected sharing</strong>
            <p><code>.env</code> files are encrypted before upload.</p>
          </div>
        </div>

        <div className="profile-card">
          <div className="avatar">{initials(currentName)}</div>
          <div className="profile-copy">
            <strong>{currentName}</strong>
            <span><i /> connected</span>
          </div>
          <button className="icon-button" onClick={handleLogout} title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <h2>{channelMeta.title}</h2>
            <p>{channelMeta.subtitle}</p>
          </div>
          <div className="header-status">
            <Sparkles size={15} />
            <span>Realtime via Convex</span>
          </div>
        </header>

        <div className="message-scroll">
          {!messages?.length && (
            <div className="empty-state">
              <div className="empty-icon">{channelMeta.icon}</div>
              <h3>{channelMeta.emptyTitle}</h3>
              <p>{channelMeta.emptyText}</p>
            </div>
          )}

          {messages?.map((message, index) => {
            const ownedByMe = Boolean(
              message.senderUserId && message.senderUserId === session.userId,
            );
            const mine = message.senderUserId
              ? ownedByMe
              : message.sender === currentName;
            const previous = messages[index - 1];
            const grouped =
              previous?.sender === message.sender &&
              message.createdAt - previous.createdAt < 5 * 60 * 1000;

            return (
              <article
                className={`message-row ${mine ? "mine" : ""} ${grouped ? "grouped" : ""}`}
                key={message._id}
              >
                {!grouped && (
                  <div className="message-avatar">{initials(message.sender)}</div>
                )}
                {grouped && <div className="message-avatar spacer" />}

                <div className="message-body">
                  {!grouped && (
                    <div className="message-meta">
                      <strong>{message.sender}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                  )}

                  {ownedByMe && (
                    <button
                      className="message-delete"
                      onClick={() => requestDelete(message)}
                      disabled={deletingId === message._id}
                      title="Delete"
                      aria-label="Delete this item"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  {message.kind === "text" && (
                    <p className="message-text">{message.text}</p>
                  )}

                  {message.kind === "voice" && (
                    <div className="voice-note">
                      <div className="voice-icon"><Mic size={17} /></div>
                      <div className="voice-player">
                        <audio
                          controls
                          preload="metadata"
                          src={message.fileUrl ?? undefined}
                        />
                        <span>
                          Voice note · {formatDuration(message.durationMs)}
                        </span>
                      </div>
                    </div>
                  )}

                  {message.kind === "file" && (
                    <div className={`file-card ${channel === "screenshots" ? "image-card" : ""}`}>
                      {channel === "screenshots" && message.fileUrl ? (
                        <div className="image-preview">
                          <Image
                            src={message.fileUrl}
                            alt={message.fileName || "Shared screenshot"}
                            fill
                            sizes="(max-width: 800px) 80vw, 520px"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className={`file-icon ${message.encrypted ? "secure" : ""}`}>
                          {message.encrypted ? <LockKeyhole size={22} /> : <FileText size={22} />}
                        </div>
                      )}

                      <div className="file-copy">
                        <strong>{message.fileName}</strong>
                        <span>
                          {formatBytes(message.fileSize)}
                          {message.encrypted ? " · client-encrypted" : ""}
                        </span>
                      </div>

                      <button
                        className="download-button"
                        onClick={() => void downloadFile(message)}
                        title="Download"
                      >
                        <Download size={17} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          <div ref={bottomRef} />
        </div>

        <footer className="composer-wrap">
          {status && (
            <div className="composer-status">
              <span>{status}</span>
              <button onClick={() => setStatus("")}>
                <X size={14} />
              </button>
            </div>
          )}

          {channel === "general" && (
            <>
              <div className={`composer general-composer ${isRecording ? "recording" : ""}`}>
                {isRecording ? (
                  <>
                    <button
                      className="record-cancel-button"
                      onClick={cancelRecording}
                      title="Cancel voice note"
                    >
                      <X size={18} />
                    </button>

                    <div className="recording-indicator">
                      <span className="recording-dot" />
                      <strong>Recording</strong>
                      <span>{formatDuration(recordingSeconds * 1000)}</span>
                    </div>

                    <button
                      className="record-stop-button"
                      onClick={stopRecording}
                      title="Stop and send voice note"
                    >
                      <Square size={16} fill="currentColor" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="mic-button"
                      onClick={() => void startRecording()}
                      disabled={uploading}
                      title="Record voice note"
                    >
                      <Mic size={19} />
                    </button>

                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={uploading ? "Sending voice note…" : "Message #general"}
                      rows={1}
                    />

                    <button
                      className="send-button"
                      onClick={() => void handleSend()}
                      disabled={!text.trim() || uploading}
                    >
                      <Send size={18} />
                    </button>
                  </>
                )}
              </div>

              <div className="composer-help">
                <span>
                  {isRecording
                    ? "Square sends · X cancels · maximum 5 minutes"
                    : "General is for text and voice notes only"}
                </span>
                {!isRecording && <span>Enter to send · Shift + Enter for a new line</span>}
              </div>
            </>
          )}

          {channel === "screenshots" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadSharedFile(file, "screenshots");
                }}
              />
              <div className="upload-composer">
                <div>
                  <ImageIcon size={20} />
                  <span>
                    <strong>Share a screenshot</strong>
                    <small>Image only · paste, drag or choose · max 8 MB</small>
                  </span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <UploadCloud size={17} />
                  {uploading ? "Uploading…" : "Choose image"}
                </button>
              </div>
            </>
          )}

          {channel === "files" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadSharedFile(file, "files");
                }}
              />
              <div className="upload-composer">
                <div>
                  <Paperclip size={20} />
                  <span>
                    <strong>Share a small file</strong>
                    <small>.env, AGENTS.md, configs and docs · max 10 MB</small>
                  </span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <UploadCloud size={17} />
                  {uploading ? "Uploading…" : "Choose file"}
                </button>
              </div>
            </>
          )}
        </footer>
      </section>
    </main>
  );
}
