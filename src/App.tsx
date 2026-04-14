import React, { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/auth/LoginPage";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ProcessedData } from "./types";
import { parseCSVFiles } from "./services/dataService";
import { motion, AnimatePresence } from "motion/react";

function AppContent() {
  const { isAuthenticated, loading, user, logout, token } = useAuth();
  const [data, setData] = useState<ProcessedData[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const fetchData = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    } else {
      setIsInitialLoading(false);
    }
  }, [isAuthenticated, token]);

  const handleFileUpload = async (csvStrings: string[]) => {
    try {
      const processed = parseCSVFiles(csvStrings);
      if (processed.length === 0) {
        setError("No valid data found in the file. Please check the format.");
        return;
      }

      setData(processed);
      setError(null);

      // Upload to server if admin
      if (user?.role === 'admin') {
        setIsUploading(true);
        const uploadId = `snap_${Date.now()}`;
        setUploadStatus("Initializing snapshot upload...");
        
        try {
          const CHUNK_SIZE = 1000;
          const totalChunks = Math.ceil(processed.length / CHUNK_SIZE);
          
          for (let i = 0; i < processed.length; i += CHUNK_SIZE) {
            const chunk = processed.slice(i, i + CHUNK_SIZE);
            const chunkIndex = i / CHUNK_SIZE;
            
            setUploadStatus(`Uploading part ${chunkIndex + 1} of ${totalChunks}... (${processed.length} records)`);
            
            const res = await fetch('/api/upload-chunk', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ 
                data: chunk, 
                chunkIndex,
                uploadId
              })
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || errData.message || `Failed to upload part ${chunkIndex + 1}`);
            }
          }

          setUploadStatus("Finalizing snapshot...");
          const finalRes = await fetch('/api/finalize-upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ uploadId })
          });

          if (!finalRes.ok) {
            const finalErr = await finalRes.json().catch(() => ({}));
            throw new Error(`Finalization failed: ${finalErr.message || 'Server error'}`);
          }
          
          setUploadStatus("Upload complete!");
          setError(null);
          setTimeout(() => {
            setIsUploading(false);
            setUploadStatus(null);
          }, 3000);
        } catch (uploadErr: any) {
          console.error("Chunked upload failed:", uploadErr);
          if (uploadErr.message?.includes("RESOURCE_EXHAUSTED")) {
            setError("Upload failed: Firebase Quota Exceeded. The data is visible locally but NOT saved for other users. Please try again tomorrow.");
          } else {
            setError(`Upload failed: ${uploadErr.message}. Data is only visible locally.`);
          }
          setIsUploading(false);
          setUploadStatus(null);
        }
      }
    } catch (err) {
      setError("Error parsing the file.");
    }
  };

  const handleClearData = async () => {
    if (user?.role !== 'admin') return;
    if (!window.confirm("Are you sure you want to clear all data? This cannot be undone.")) return;
    
    try {
      const res = await fetch('/api/data', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setData([]);
        setError(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error?.includes("RESOURCE_EXHAUSTED")) {
          setError("Failed to clear data: Firebase Quota Exceeded. Please try again tomorrow or upgrade your Firebase plan.");
        } else {
          setError(`Failed to clear data: ${errData.error || errData.message || 'Unknown error'}`);
        }
      }
    } catch (err) {
      setError("Network error: failed to clear data.");
    }
  };

  if (loading || isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!isAuthenticated ? (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <LoginPage />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Dashboard 
            data={data} 
            onFileUpload={handleFileUpload} 
            onClearData={handleClearData}
            user={user!} 
            onLogout={logout}
            onRefresh={fetchData}
            error={error}
            setError={setError}
            uploadStatus={uploadStatus}
            isUploading={isUploading}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
