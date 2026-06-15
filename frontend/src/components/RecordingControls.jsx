import { useState, useEffect } from 'react';
import { useRecording } from '../contexts/RecordingContext';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import server from '../environment';
import styles from '../styles/videoComponent.module.css';

export default function RecordingControls({ isOwner, meetingCode }) {
  const {
    isRecording,
    recordingError,
    startRecording,
    stopRecording,
    audioBlob,
    resetRecording,
  } = useRecording();

  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    if (!audioBlob || uploadStatus?.status === 'uploading') return;

    const formData = new FormData();
    formData.append('audio', audioBlob, `recording-${Date.now()}.webm`);
    formData.append('meetingId', meetingCode);

    setUploadStatus({ status: 'uploading', percent: 0 });

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadStatus({
          status: 'uploading',
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadStatus({ status: 'success' });
        setTimeout(() => setUploadStatus(null), 5000);
      } else {
        setUploadStatus({ status: 'error', message: 'Upload failed' });
      }
    };

    xhr.onerror = () => {
      setUploadStatus({ status: 'error', message: 'Network error' });
    };

    xhr.open('POST', `${server}/api/v1/recordings/upload`);
    xhr.send(formData);
  }, [audioBlob]);

  if (!isOwner) return null;

  return (
    <>
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`${styles.controlButton} ${isRecording ? styles.controlRecording : ''}`}
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
      >
        {isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
      </button>
      {recordingError && (
        <div className={styles.recordingError}>
          {recordingError}
        </div>
      )}
      {uploadStatus && (
        <div className={`${styles.uploadStatus} ${styles['uploadStatus' + (uploadStatus.status === 'uploading' ? 'uploading' : uploadStatus.status === 'success' ? 'success' : 'error')]}`}>
          {uploadStatus.status === 'uploading' && (
            <>
              <span>Uploading {uploadStatus.percent}%</span>
              <div className={styles.uploadBar}>
                <div className={styles.uploadBarFill}
                  style={{ width: `${uploadStatus.percent}%` }} />
              </div>
            </>
          )}
          {uploadStatus.status === 'success' && (
            <span>Recording uploaded</span>
          )}
          {uploadStatus.status === 'error' && (
            <span>{uploadStatus.message}</span>
          )}
        </div>
      )}
    </>
  );
}
