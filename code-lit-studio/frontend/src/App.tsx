// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css'; // Importing the main CSS
import BackupManager from './components/BackupManager';
import Chat from './components/Chat';
import Notification from './components/Notification';
import Editor from '@monaco-editor/react';
import socket, { connectSocket } from './socket'; // Import the socket

function App() {
  console.log('App.tsx is mounting...');

  // Hard-coded project ID for now
  const [projectId] = useState('my-website');

  // State variables
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [chatLog, setChatLog] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [refreshPreview, setRefreshPreview] = useState<number>(0);
  const [notifications, setNotifications] = useState<{ message: string; type: 'success' | 'error' }[]>([]);

  // Initialize Socket.IO
  useEffect(() => {
    console.log('Connecting Socket.IO client to http://localhost:3001');
    connectSocket();

    socket.on('metaAction', (metaAction: any) => {
      console.log('[socket] metaAction event:', metaAction);
      handleMetaAction(metaAction);
    });

    socket.on('userUpdate', (update: any) => {
      console.log('[socket] userUpdate event:', update);
      handleUserUpdate(update);
    });

    return () => {
      console.log('Cleaning up socket in useEffect...');
      socket.off('metaAction');
      socket.off('userUpdate');
      socket.disconnect();
    };
  }, [projectId, selectedFile]);

  // Fetch file list on mount
  useEffect(() => {
    console.log(`Fetching file list for projectId: ${projectId} from port 3001...`);
    fetchFileList();
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

  async function openFile(file: string) {
    console.log(`openFile called with: ${file}`);
    setSelectedFile(file);

    try {
      const res = await axios.get(`http://localhost:3001/api/${projectId}/file`, {
        params: { filename: file },
      });
      setFileContent(res.data.content);
      setError('');
      console.log(`File content for ${file}:`, res.data.content);
    } catch (err: any) {
      console.error(`Error reading file ${file}:`, err);
      setError(`Failed to read file ${file}.`);
    }
  }

  async function saveFile() {
    if (!selectedFile) return;
    console.log(`saveFile called for: ${selectedFile}`);
    try {
      await axios.post(`http://localhost:3001/api/${projectId}/file`, {
        filename: selectedFile,
        content: fileContent,
      });
      setSuccess(`Saved ${selectedFile} successfully.`);
      setError('');
      setRefreshPreview(prev => prev + 1);
      console.log(`File ${selectedFile} saved successfully.`);
    } catch (err: any) {
      console.error(`Error saving file ${selectedFile}:`, err);
      setError(`Failed to save file ${selectedFile}.`);
      setSuccess('');
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) return;
    console.log('sendChatMessage called:', chatInput);

    try {
      setChatLog(prev => [...prev, `You: ${chatInput}`]);
      const userMessage = chatInput;
      setChatInput('');

      const res = await axios.post('http://localhost:3001/api/chat', {
        userMessages: [userMessage],
        projectId,
      });

      const gptReply = res.data.reply;
      setChatLog(prev => [...prev, `GPT: ${gptReply}`]);
      console.log('GPT reply received:', gptReply);

      setError('');
      setSuccess('');
    } catch (err: any) {
      console.error('Error with GPT chat:', err);
      setError('Failed to communicate with GPT.');
    }
  }

  function handleMetaAction(metaAction: any) {
    const { action, target, data } = metaAction;
    switch (action) {
      case 'refresh_component':
        if (target === 'fileViewer' && data.filename === selectedFile) {
          openFile(data.filename);
        }
        if (target === 'fileViewer' || target === 'fileList') {
          fetchFileList();
        }
        break;
      case 'display_notification':
        const { type, message } = data;
        setNotifications(prev => [...prev, { type, message }]);
        break;
      // Handle other metaAction cases as needed
      default:
        console.warn(`Unhandled metaAction: ${action}`);
    }
  }

  function handleUserUpdate(update: any) {
    const { update: updateMessage } = update;
    setChatLog(prev => [...prev, `Update: ${updateMessage}`]);
  }

  function getLanguage(filename: string): string {
    const ext = filename.split('.').pop();
    switch (ext) {
      case 'js': return 'javascript';
      case 'css': return 'css';
      case 'html': return 'html';
      default: return 'plaintext';
    }
  }

  return (
    <div className="app-container">
      {/* LEFT: Sidebar (file list) */}
      <div className="sidebar">
        <h2>Files</h2>
        {error && <Notification message={error} type="error" />}
        {success && <Notification message={success} type="success" />}
        <ul>
          {files.map(file => (
            <li key={file} onClick={() => openFile(file)} className={file === selectedFile ? 'active-file' : ''}>
              {file}
            </li>
          ))}
        </ul>
      </div>

      {/* MIDDLE: Live Preview */}
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
              <BackupManager projectId={projectId} filename={selectedFile} />
            </>
          )}
        </div>
        <Chat chatLog={chatLog} chatInput={chatInput} setChatInput={setChatInput} sendChatMessage={sendChatMessage} />
      </div>

      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map((notif, index) => (
          <Notification
            key={index}
            message={notif.message}
            type={notif.type}
            onClose={() => setNotifications(prev => prev.filter((_, i) => i !== index))}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
