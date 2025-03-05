import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css'; // Importing the main CSS
import BackupManager from './components/BackupManager';
import Chat from './components/Chat';
import Notification from './components/Notification';
import Editor from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';

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
  const [refreshPreview, setRefreshPreview] = useState<number>(0); // For iframe refresh

  // -----------------------------------------
  // 1) Initialize Socket.IO (port 3001)
  // -----------------------------------------
  useEffect(() => {
    console.log('Setting up Socket.IO client -> connecting to http://localhost:3001');
    const socket: Socket = io('http://localhost:3001');

    // Listen for file updates from backend
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
      const res = await axios.get(`http://localhost:3001/api/${projectId}/files`);
      setFiles(res.data);
      setError('');
      console.log('File list received:', res.data);
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
      const res = await axios.get(`http://localhost:3001/api/${projectId}/file`, {
        params: { filename: file },
      });
      setFileContent(res.data.content);
      setError('');
      console.log(`File content for ${file}:`, res.data.content);
    } catch (err: any) {
      console.error(`Error reading file (port 3001) ${file}:`, err);
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
      await axios.post(`http://localhost:3001/api/${projectId}/file`, {
        filename: selectedFile,
        content: fileContent,
      });
      setSuccess(`Saved ${selectedFile} successfully.`);
      setError('');
      setRefreshPreview((prev) => prev + 1);
      console.log(`File ${selectedFile} saved successfully (port 3001).`);
    } catch (err: any) {
      console.error(`Error saving file (port 3001) ${selectedFile}:`, err);
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
      const res = await axios.post('http://localhost:3001/api/chat', {
        userMessages: [chatInput],
        projectId,
      });

      // GPT reply
      const gptReply = res.data.reply;
      const functionResults = res.data.functionResults;

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
  // RENDER
  // -----------------------------------------
  return (
    <div className="app-container">
      {/* LEFT: Sidebar (file list) */}
      <div className="sidebar">
        <h2>Files</h2>
        {error && <Notification message={error} type="error" />}
        {success && <Notification message={success} type="success" />}
        <ul>
          {files.map((file) => (
            <li
              key={file}
              onClick={() => openFile(file)}
              className={file === selectedFile ? 'active-file' : ''}
            >
              {file}
            </li>
          ))}
        </ul>
      </div>

      {/* MIDDLE: Live Preview (iframe pointing to port 3001) */}
      <div className="preview-panel">
        <iframe
          key={refreshPreview}
          title="Live Preview"
          src={`http://localhost:3001/projects/${projectId}/index.html?refresh=${refreshPreview}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      {/* RIGHT: Editor + Chat */}
      <div className="editor-panel">
        <div className="editor">
          <h3>{selectedFile || 'Select a file'}</h3>
          {selectedFile && (
            <>
              <Editor
                height="300px"
                language={getLanguage(selectedFile)}
                value={fileContent}
                onChange={(value) => setFileContent(value || '')}
                theme="vs-dark"
              />
              <button onClick={saveFile}>Save</button>
              {/* Backup Manager */}
              <BackupManager projectId={projectId} filename={selectedFile} />
            </>
          )}
        </div>

        {/* The Chat panel */}
        <Chat
          chatLog={chatLog}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sendChatMessage={sendChatMessage}
        />
      </div>
    </div>
  );
}

export default App;
