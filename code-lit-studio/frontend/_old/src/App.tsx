// App.tsx
import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Save, Send, File } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';

import BackupManager from './components/BackupManager';
import Chat from './components/Chat';
import Notification from './components/Notification';
// import './App.css'; // Remove or keep if you still need custom styles

function App() {
  console.log('App.tsx is mounting...');

  // Hard-coded project ID for now
  const [projectId] = useState('my-website');

  // State: files, file content, chat, errors, etc.
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [chatLog, setChatLog] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [refreshPreview, setRefreshPreview] = useState<number>(0);

  // Collapsible sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // -----------------------------------------
  // 1) Initialize Socket.IO (port 3001)
  // -----------------------------------------
  useEffect(() => {
    console.log('Setting up Socket.IO client -> connecting to http://localhost:3001');
    const socket: Socket = io('http://localhost:3001');

    socket.on('fileUpdated', (data: { projectId: string; filename: string }) => {
      console.log('[socket] fileUpdated event on port 3001:', data);
      if (data.projectId === projectId) {
        if (data.filename === selectedFile) {
          openFile(data.filename);
        }
        setRefreshPreview((prev) => prev + 1);
      }
    });

    socket.on('fileRestored', (data: { projectId: string; filename: string; backupName: string }) => {
      console.log('[socket] fileRestored event on port 3001:', data);
      if (data.projectId === projectId) {
        if (data.filename === selectedFile) {
          openFile(data.filename);
        }
        setRefreshPreview((prev) => prev + 1);
      }
    });

    socket.on('backupDeleted', (data: { projectId: string; filename: string; backupName: string }) => {
      console.log('[socket] backupDeleted event on port 3001:', data);
      // Optionally refresh UI or backups
    });

    return () => {
      console.log('Cleaning up socket in useEffect...');
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedFile]);

  // -----------------------------------------
  // 2) On mount, fetch file list from port 3001
  // -----------------------------------------
  useEffect(() => {
    console.log(`Fetching file list for projectId: ${projectId} from port 3001...`);
    fetchFileList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function fetchFileList() {
    try {
      console.log(`GET -> http://localhost:3001/api/${projectId}/files`);
      const res = await fetch(`http://localhost:3001/api/${projectId}/files`);
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      setFiles(data);
      setError('');
      console.log('File list received:', data);
    } catch (err: any) {
      console.error('Error fetching files (port 3001):', err);
      setError('Failed to fetch files.');
    }
  }

  // -----------------------------------------
  // 3) Open a file (read from port 3001)
  // -----------------------------------------
  async function openFile(file: string) {
    console.log(`openFile called with: ${file}, GET -> http://localhost:3001/api/${projectId}/file?filename=${file}`);
    setSelectedFile(file);

    try {
      const res = await fetch(`http://localhost:3001/api/${projectId}/file?filename=${file}`);
      if (!res.ok) throw new Error(`Failed to read file ${file}`);
      const data = await res.json();
      setFileContent(data.content);
      setError('');
      console.log(`File content for ${file}:`, data.content);
    } catch (err: any) {
      console.error(`Error reading file ${file}:`, err);
      setError(`Failed to read file ${file}.`);
    }
  }

  // -----------------------------------------
  // 4) Save file (POST to port 3001)
  // -----------------------------------------
  async function saveFile() {
    if (!selectedFile) return;
    console.log(`saveFile called for: ${selectedFile}. POST -> http://localhost:3001/api/${projectId}/file`);
    try {
      const res = await fetch(`http://localhost:3001/api/${projectId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile,
          content: fileContent,
        }),
      });
      if (!res.ok) throw new Error(`Failed to save file ${selectedFile}`);
      setSuccess(`Saved ${selectedFile} successfully.`);
      setError('');
      setRefreshPreview((prev) => prev + 1);
      console.log(`File ${selectedFile} saved successfully (port 3001).`);
    } catch (err: any) {
      console.error(`Error saving file ${selectedFile}:`, err);
      setError(`Failed to save file ${selectedFile}.`);
      setSuccess('');
    }
  }

  // -----------------------------------------
  // 5) Send Chat Message (POST to port 3001)
  // -----------------------------------------
  async function sendChatMessage() {
    if (!chatInput.trim()) return;
    console.log('sendChatMessage called:', chatInput);

    try {
      // Add user’s message to chat log
      const updatedLog = [...chatLog, `You: ${chatInput}`];
      setChatLog(updatedLog);
      setChatInput('');

      console.log(`POST -> http://localhost:3001/api/chat (with projectId=${projectId})`);
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessages: [chatInput],
          projectId,
        }),
      });
      if (!res.ok) throw new Error('Failed to communicate with GPT');
      const data = await res.json();

      // GPT reply
      const gptReply = data.reply;
      const functionResults = data.functionResults;

      setChatLog((prev) => [...prev, `GPT: ${gptReply}`]);
      console.log('GPT reply received:', gptReply);

      if (functionResults && functionResults.length > 0) {
        functionResults.forEach((result: any) => {
          if (result.status === 'success') {
            setChatLog((prev) => [
              ...prev,
              `✅ ${result.function} succeeded: ${result.result}`,
            ]);
          } else {
            setChatLog((prev) => [
              ...prev,
              `❌ ${result.function} failed: ${result.error}`,
            ]);
          }
        });
      }

      setError('');
      setSuccess('');
    } catch (err: any) {
      console.error('Error with GPT chat (port 3001):', err);
      setError('Failed to communicate with GPT.');
    }
  }

  // -----------------------------------------
  // 6) Detect file language for Monaco Editor
  // -----------------------------------------
  function getLanguage(filename: string): string {
    const ext = filename.split('.').pop();
    switch (ext) {
      case 'js':
        return 'javascript';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      default:
        return 'plaintext';
    }
  }

  // -----------------------------------------
  // RENDER (3-column layout with collapsible sidebar)
  // -----------------------------------------
  return (
    <div className="flex h-screen bg-gray-900">
      {/* LEFT: Collapsible Sidebar */}
      <div
        className={`relative transition-all duration-300 ${
          isSidebarCollapsed ? 'w-12' : 'w-64'
        } bg-gray-800 text-white`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-4 bg-gray-700 rounded-full p-1 z-10 hover:bg-gray-600"
        >
          {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Sidebar Content */}
        <div
          className={`h-full overflow-y-auto ${
            isSidebarCollapsed ? 'invisible' : ''
          }`}
        >
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Files</h2>
            {error && <Notification message={error} type="error" />}
            {success && <Notification message={success} type="success" />}

            <ul className="space-y-1">
              {files.map((file) => (
                <li
                  key={file}
                  onClick={() => openFile(file)}
                  className={`flex items-center p-2 rounded cursor-pointer hover:bg-gray-700 ${
                    file === selectedFile ? 'bg-blue-600' : ''
                  }`}
                >
                  <File size={16} className="mr-2" />
                  <span className="truncate">{file}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* MIDDLE: Live Preview */}
      <div className="flex-1 border-x border-gray-700">
        <iframe
          key={refreshPreview}
          title="Live Preview"
          src={`http://localhost:3001/projects/${projectId}/index.html?refresh=${refreshPreview}`}
          className="w-full h-full border-none bg-white"
        />
      </div>

      {/* RIGHT: Editor & Chat (fixed width) */}
      <div className="w-96 bg-gray-800 flex flex-col">
        {/* Editor Section (top half) */}
        <div className="h-1/2 border-b border-gray-700 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-semibold">
              {selectedFile || 'Select a file'}
            </h3>
            {selectedFile && (
              <button
                onClick={saveFile}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Save size={16} />
                Save
              </button>
            )}
          </div>

          {selectedFile ? (
            <>
              <Editor
                height="calc(100% - 3rem)"
                language={getLanguage(selectedFile)}
                value={fileContent}
                onChange={(value) => setFileContent(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                }}
              />

              {/* BackupManager Component */}
              <div className="mt-4">
                <BackupManager projectId={projectId} filename={selectedFile} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No file selected. Choose one from the left sidebar.
            </div>
          )}
        </div>

        {/* Chat Section (bottom half) */}
        <div className="flex-1 flex flex-col p-4">
          <Chat
            chatLog={chatLog}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChatMessage={sendChatMessage}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
