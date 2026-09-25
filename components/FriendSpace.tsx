"use client";

import Image from "next/image";
import {
  ArrowRight,
  Check,
  Download,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Image as ImageIcon,
  LockKeyhole,
  LogOut,
  Mail,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { decryptSensitiveFile, encryptSensitiveFile, isSensitiveEnvFile } from "@/lib/crypto";

type Filter = "all" | "files" | "screenshots";

type Message = {
  _id: string;
  sender: string;
  kind: "text" | "file";
  text?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  encrypted?: boolean;
  fileUrl?: string | null;
  createdAt: number;
};

const api = anyApi;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isImageMessage(message: Message) {
  return Boolean(message.mimeType?.startsWith("image/") && !message.encrypted);
}

export function DevCache() {
  const signup = useMutation(api.auth.signup);
  const login = useMutation(api.auth.login);
  const logoutMutation = useMutation(api.auth.logout);
  const sendText = useMutation(api.messages.sendText);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendFile = useMutation(api.messages.sendFile);

  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const local = window.localStorage.getItem("devcache-session-token");
    const sessionOnly = window.sessionStorage.getItem("devcache-session-token");
    const legacy = window.localStorage.getItem("friendspace-session-token");
    const saved = local ?? sessionOnly ?? legacy;

    if (saved) {
      setToken(saved);
      if (legacy && !local) {
        window.localStorage.setItem("devcache-session-token", legacy);
        window.localStorage.removeItem("friendspace-session-token");
      }
    }
  }, []);

  const session = useQuery(api.auth.session, token ? { token } : "skip");
  const messages = useQuery(api.messages.list, token && session ? { token } : "skip") as Message[] | undefined;
  const fileEncryptionKey = useQuery(api.auth.fileEncryptionKey, token && session ? { token } : "skip") as string | null | undefined;

  useEffect(() => {
    if (messages?.length) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    if (filter === "files") return messages.filter((message) => message.kind === "file");
    if (filter === "screenshots") return messages.filter((message) => isImageMessage(message));
    return messages;
  }, [filter, messages]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const nextToken = makeSessionToken();
      if (authMode === "signup") {
        await signup({ displayName, email, password, token: nextToken });
      } else {
        await login({ email, password, token: nextToken });
      }
      window.localStorage.removeItem("devcache-session-token");
      window.sessionStorage.removeItem("devcache-session-token");
      const storage = rememberMe ? window.localStorage : window.sessionStorage;
      storage.setItem("devcache-session-token", nextToken);
      setToken(nextToken);
      setPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    if (token) {
      try {
        await logoutMutation({ token });
      } catch {
        // Local sign-out still proceeds if the network is unavailable.
      }
    }
    window.localStorage.removeItem("devcache-session-token");
    window.sessionStorage.removeItem("devcache-session-token");
    window.localStorage.removeItem("friendspace-session-token");
    setToken(null);
  }

  async function handleSend() {
    if (!token || !text.trim()) return;
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

  async function uploadFile(file: File) {
    if (!token || uploading) return;
    if (file.size > MAX_FILE_SIZE) {
      setStatus("That file is larger than the 25 MB workspace limit.");
      return;
    }

    setStatus("");
    setUploading(true);
    try {
      const encrypted = isSensitiveEnvFile(file.name);
      let uploadBody: Blob | File = file;

      if (encrypted) {
        if (!fileEncryptionKey) throw new Error("Encrypted .env sharing is not configured yet.");
        uploadBody = await encryptSensitiveFile(file, fileEncryptionKey);
      }

      const uploadUrl = await generateUploadUrl({ token });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": uploadBody.type || "application/octet-stream" },
        body: uploadBody,
      });

      if (!response.ok) throw new Error("The file upload failed.");
      const { storageId } = (await response.json()) as { storageId: string };

      await sendFile({
        token,
        storageId: storageId as never,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        encrypted,
      });

      setStatus(encrypted ? "Encrypted .env file shared safely." : "File shared.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function downloadFile(message: Message) {
    if (!message.fileUrl || !message.fileName) return;
    setStatus("");
    try {
      const response = await fetch(message.fileUrl);
      if (!response.ok) throw new Error("Could not download this file.");
      const payload = await response.arrayBuffer();
      let blob = new Blob([payload], { type: message.mimeType || "application/octet-stream" });

      if (message.encrypted) {
        if (!fileEncryptionKey) throw new Error("Encrypted .env sharing is not configured yet.");
        blob = await decryptSensitiveFile(payload, fileEncryptionKey, message.mimeType || "text/plain");
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

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      void uploadFile(file);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  if (!token || session === null) {
    const signingUp = authMode === "signup";

    return (
      <main className="login-shell devcache-auth">
        <div className="auth-orb auth-orb-one" aria-hidden="true" />
        <div className="auth-orb auth-orb-two" aria-hidden="true" />
        <div className="auth-orb auth-orb-three" aria-hidden="true" />

        <section className="login-card devcache-login-card">
          <div className="devcache-logo-wrap">
            <Image
              src="/devcache-logo.svg"
              alt="DevCache encrypted developer workspace"
              width={142}
              height={142}
              priority
              className="devcache-logo"
            />
          </div>

          <div className="devcache-wordmark" aria-label="DevCache">
            <span>Dev</span><strong>Cache</strong>
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
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label className="neo-field">
              <Mail size={21} />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email"
                autoComplete="email"
                required
              />
            </label>

            <label className="neo-field">
              <LockKeyhole size={21} />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder={signingUp ? "Password · at least 8 characters" : "Password"}
                autoComplete={signingUp ? "new-password" : "current-password"}
                minLength={8}
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

            {loginError && <div className="error-note">{loginError}</div>}

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
                  setPassword("");
                }}
              >
                {signingUp ? "Sign in" : "Create an account"}
              </button>
            </p>
            <span />
          </div>

          <div className="login-footnote devcache-footnote">
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
    return <main className="loading-screen"><div className="pulse-logo"><Image src="/devcache-logo.svg" alt="" width={38} height={38} /></div><p>Opening DevCache…</p></main>;
  }

  const currentName = session.displayName;

  return (
    <main
      className={`workspace ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {dragging && <div className="drop-overlay"><UploadCloud size={34} /><strong>Drop to share</strong><span>Up to 25 MB</span></div>}

      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark small"><Image src="/devcache-logo.svg" alt="" width={30} height={30} /></span><div><strong>DevCache</strong><small>private workspace</small></div></div>

        <nav className="nav-group" aria-label="Message filters">
          <span className="nav-label">Workspace</span>
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><Hash size={17} /><span>general</span></button>
          <button className={filter === "files" ? "active" : ""} onClick={() => setFilter("files")}><FileText size={17} /><span>files</span></button>
          <button className={filter === "screenshots" ? "active" : ""} onClick={() => setFilter("screenshots")}><ImageIcon size={17} /><span>screenshots</span></button>
        </nav>

        <div className="security-card">
          <ShieldCheck size={18} />
          <div><strong>Protected sharing</strong><p><code>.env</code> files are encrypted before upload.</p></div>
        </div>

        <div className="profile-card">
          <div className="avatar">{initials(currentName)}</div>
          <div className="profile-copy"><strong>{currentName}</strong><span><i /> connected</span></div>
          <button className="icon-button" onClick={handleLogout} title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div><h2>{filter === "all" ? "# general" : filter === "files" ? "# files" : "# screenshots"}</h2><p>{filter === "all" ? "The shared room for your group" : filter === "files" ? "Files shared in the workspace" : "Images and pasted screenshots"}</p></div>
          <div className="header-status"><Sparkles size={15} /><span>Realtime via Convex</span></div>
        </header>

        <div className="message-scroll">
          {!filteredMessages.length && (
            <div className="empty-state">
              <div className="empty-icon"><Users size={26} /></div>
              <h3>{filter === "all" ? "Start the conversation" : "Nothing here yet"}</h3>
              <p>{filter === "all" ? "Send a message, attach a file, or paste a screenshot directly into the composer." : "Shared items matching this filter will appear here."}</p>
            </div>
          )}

          {filteredMessages.map((message, index) => {
            const mine = message.sender === currentName;
            const previous = filteredMessages[index - 1];
            const grouped = previous?.sender === message.sender && message.createdAt - previous.createdAt < 5 * 60 * 1000;
            return (
              <article className={`message-row ${mine ? "mine" : ""} ${grouped ? "grouped" : ""}`} key={message._id}>
                {!grouped && <div className="message-avatar">{initials(message.sender)}</div>}
                {grouped && <div className="message-avatar spacer" />}
                <div className="message-body">
                  {!grouped && <div className="message-meta"><strong>{message.sender}</strong><span>{formatTime(message.createdAt)}</span></div>}
                  {message.kind === "text" && <p className="message-text">{message.text}</p>}
                  {message.kind === "file" && (
                    <div className={`file-card ${isImageMessage(message) ? "image-card" : ""}`}>
                      {isImageMessage(message) && message.fileUrl ? (
                        <div className="image-preview">
                          <Image src={message.fileUrl} alt={message.fileName || "Shared screenshot"} fill sizes="(max-width: 800px) 80vw, 520px" unoptimized />
                        </div>
                      ) : (
                        <div className={`file-icon ${message.encrypted ? "secure" : ""}`}>{message.encrypted ? <LockKeyhole size={22} /> : <FileText size={22} />}</div>
                      )}
                      <div className="file-copy">
                        <strong>{message.fileName}</strong>
                        <span>{formatBytes(message.fileSize)}{message.encrypted ? " · client-encrypted" : ""}</span>
                      </div>
                      <button className="download-button" onClick={() => void downloadFile(message)} title="Download"><Download size={17} /></button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <footer className="composer-wrap">
          {status && <div className="composer-status"><span>{status}</span><button onClick={() => setStatus("")}><X size={14} /></button></div>}
          <div className="composer">
            <input ref={fileInputRef} type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); }} />
            <button className="attach-button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach file"><Paperclip size={19} /></button>
            <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleComposerKeyDown} onPaste={handlePaste} placeholder={uploading ? "Uploading file…" : "Message #general — paste screenshots here too"} rows={1} />
            <button className="send-button" onClick={() => void handleSend()} disabled={!text.trim() || uploading}><Send size={18} /></button>
          </div>
          <div className="composer-help"><span>Enter to send · Shift + Enter for a new line</span><span>Files up to 25 MB</span></div>
        </footer>
      </section>
    </main>
  );
}
