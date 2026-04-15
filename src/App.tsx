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

      // 1. Instant Preview: Update dashboard state immediately
      setData(processed);
      setError(null);

      // 2. Background Upload to Supabase (Chunked to bypass Vercel 4.5MB limit)
      if (user?.role === 'admin') {
        setIsUploading(true);
        setUploadStatus("Starting background upload...");
        
        try {
          // A. Clear table first
          const startRes = await fetch('/api/upload/start', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!startRes.ok) throw new Error("Failed to initialize upload");

          // B. Upload in chunks of 1,000 rows
          const CHUNK_SIZE = 1000;
          const totalChunks = Math.ceil(processed.length / CHUNK_SIZE);
          
          for (let i = 0; i < processed.length; i += CHUNK_SIZE) {
            const chunk = processed.slice(i, i + CHUNK_SIZE);
            const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
            
            setUploadStatus(`Saving to database... Part ${chunkNum} of ${totalChunks}`);
            
            const chunkRes = await fetch('/api/upload/chunk', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ data: chunk })
            });

            if (!chunkRes.ok) {
              const errData = await chunkRes.json().catch(() => ({}));
              throw new Error(errData.error || errData.message || `Failed at part ${chunkNum}`);
            }
          }

          setUploadStatus("All data saved to cloud!");
          // Final sync with database to ensure everything is matched correctly
          await fetchData();
          
          setTimeout(() => {
            setIsUploading(false);
            setUploadStatus(null);
          }, 3000);
        } catch (uploadErr: any) {
          console.error("Background upload failed:", uploadErr);
          setError(`Cloud Sync Failed: ${uploadErr.message}. Data is only visible locally.`);
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
        setError(`Failed to clear data: ${errData.error || errData.message || 'Unknown error'}`);
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
