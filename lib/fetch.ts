import { useState, useEffect, useCallback } from "react";

// Add retry functionality and better error handling to fetchAPI
export const fetchAPI = async (
  url: string, 
  options?: RequestInit, 
  retries = 3,
  backoff = 300
) => {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the response as text first
      const text = await response.text();
      
      // Check for empty response
      if (!text) {
        throw new Error('Empty response received from server');
      }

      try {
        // Attempt to parse JSON
        return JSON.parse(text);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError, 'Response:', text);
        throw new Error('Invalid JSON response from server');
      }

    } catch (error: any) {
      lastError = error;
      
      // Don't retry if we've been aborted or if it's a 404
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      
      if (error instanceof Response && error.status === 404) {
        throw new Error('Resource not found');
      }

      // If this isn't our last try, wait before retrying
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
        continue;
      }
    }
  }

  // If we got here, we failed all retries
  throw new Error(
    lastError instanceof Error 
      ? lastError.message 
      : 'Failed to connect to server after multiple attempts'
  );
};

// Helper function to check network connectivity
export const checkConnectivity = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const useFetch = <T>(url: string, options?: RequestInit) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchAPI(url, options);
      setData(result.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};