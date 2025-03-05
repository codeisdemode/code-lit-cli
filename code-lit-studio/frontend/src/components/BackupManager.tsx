// frontend/src/components/BackupManager.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Notification from './Notification';

interface BackupManagerProps {
  projectId: string;
  filename: string;
}

const BackupManager: React.FC<BackupManagerProps> = ({ projectId, filename }) => {
  const [backups, setBackups] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    fetchBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filename]);

  async function fetchBackups() {
    try {
      console.log(`GET -> http://localhost:3001/api/${projectId}/file/backups?filename=${filename}`);
      const res = await axios.get(`http://localhost:3001/api/${projectId}/file/backups`, {
        params: { filename },
      });
      setBackups(res.data.backups);
      setError('');
      console.log('Backups received:', res.data.backups);
    } catch (err: any) {
      console.error('Error fetching backups:', err);
      setError('Failed to fetch backups.');
    }
  }

  async function restoreBackup(backupName: string) {
    try {
      console.log(`POST -> http://localhost:3001/api/${projectId}/file/restore`);
      await axios.post(`http://localhost:3001/api/${projectId}/file/restore`, {
        filename,
        backupName,
      });
      setSuccess(`Backup ${backupName} restored successfully.`);
      setError('');
      fetchBackups();
    } catch (err: any) {
      console.error('Error restoring backup:', err);
      setError(`Failed to restore backup ${backupName}.`);
      setSuccess('');
    }
  }

  async function deleteBackup(backupName: string) {
    try {
      console.log(`DELETE -> http://localhost:3001/api/${projectId}/file/backups`);
      await axios.delete(`http://localhost:3001/api/${projectId}/file/backups`, {
        data: { filename, backupName },
      });
      setSuccess(`Backup ${backupName} deleted successfully.`);
      setError('');
      fetchBackups();
    } catch (err: any) {
      console.error('Error deleting backup:', err);
      setError(`Failed to delete backup ${backupName}.`);
      setSuccess('');
    }
  }

  return (
    <div className="backup-manager">
      <h4>Backups</h4>
      {error && <Notification message={error} type="error" />}
      {success && <Notification message={success} type="success" />}
      {backups.length === 0 ? (
        <p>No backups available.</p>
      ) : (
        <ul>
          {backups.map((backup) => (
            <li key={backup}>
              {backup}
              <div>
                <button onClick={() => restoreBackup(backup)}>Restore</button>
                <button onClick={() => deleteBackup(backup)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BackupManager;
