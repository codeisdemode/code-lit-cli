// frontend/src/components/BackupManager.tsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';

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
  }, [projectId, filename]);

  const fetchBackups = async () => {
    try {
      const res = await axios.get(`/api/${projectId}/file/backups`, {
        params: { filename },
      });
      setBackups(res.data.backups);
      setError('');
    } catch (err: any) {
      console.error('Error fetching backups:', err);
      setError('Failed to fetch backups.');
    }
  };

  const restoreBackup = async (backupName: string) => {
    try {
      await axios.post(`/api/${projectId}/file/restore`, {
        filename,
        backupName,
      });
      setSuccess(`Restored backup ${backupName} successfully.`);
      fetchBackups();
    } catch (err: any) {
      console.error('Error restoring backup:', err);
      setError(`Failed to restore backup ${backupName}.`);
      setSuccess('');
    }
  };

  const deleteBackup = async (backupName: string) => {
    try {
      await axios.delete(`/api/${projectId}/file/backups`, {
        data: { filename, backupName },
      });
      setSuccess(`Deleted backup ${backupName} successfully.`);
      fetchBackups();
    } catch (err: any) {
      console.error('Error deleting backup:', err);
      setError(`Failed to delete backup ${backupName}.`);
      setSuccess('');
    }
  };

  return (
    <div className="backup-manager">
      <h4>Backups for {filename}</h4>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      {backups.length === 0 ? (
        <p>No backups available.</p>
      ) : (
        <ul>
          {backups.map((backup) => (
            <li key={backup}>
              {backup}
              <button onClick={() => restoreBackup(backup)}>Restore</button>
              <button onClick={() => deleteBackup(backup)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BackupManager;
