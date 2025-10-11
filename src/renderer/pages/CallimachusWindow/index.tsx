import React, { useState, useEffect } from 'react';
import { CallimachusClient } from '@a24z/callimachus';
import type {
  CallimachusConfig,
  SearchResult,
  AlexandriaLayout,
} from '@a24z/callimachus';
import { ConnectionPanel } from './components/ConnectionPanel';
import { SearchInterface } from './components/SearchInterface';
import { ResultsDisplay } from './components/ResultsDisplay';
import { CallimachusTitlebar } from '../../components/Titlebar';
import { useTheme } from '@a24z/industry-theme';

export const CallimachusWindow: React.FC = () => {
  const { theme } = useTheme();
  const [client, setClient] = useState<CallimachusClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load saved connection settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('callimachus-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        handleConnect(settings);
      } catch (error) {
        console.error('Failed to load saved settings:', error);
      }
    }
  }, []);

  const handleConnect = async (config: CallimachusConfig) => {
    setConnectionError(null);
    try {
      const newClient = new CallimachusClient(config);

      // Ensure the client is fully initialized (table creation, etc.)
      try {
        console.log('Initializing Pixeltable tables...');
        await newClient.ensureInitialized();
        console.log('Table initialization complete');
      } catch (initError) {
        console.error('Initialization error:', initError);
        setConnectionError(
          initError instanceof Error
            ? `Initialization failed: ${initError.message}`
            : 'Failed to initialize Pixeltable tables',
        );
        setIsConnected(false);
        return;
      }

      // Test the connection with a simple browse call
      try {
        console.log('Testing connection to Pixeltable...');
        const testResult = await newClient.browse({ limit: 1 });
        console.log('Connection test successful:', testResult);

        setClient(newClient);
        setIsConnected(true);

        // Save settings for next time
        localStorage.setItem('callimachus-settings', JSON.stringify(config));
      } catch (testError) {
        // Connection test failed
        console.error('Connection test failed:', testError);
        setConnectionError(
          testError instanceof Error
            ? `Connection failed: ${testError.message}. Make sure Pixeltable is running at ${config.pixeltable?.apiUrl}`
            : 'Connection test failed. Check if Pixeltable server is running.',
        );
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Client creation failed:', error);
      setConnectionError(
        error instanceof Error ? error.message : 'Failed to create client',
      );
      setIsConnected(false);
    }
  };

  const handleDisconnect = () => {
    setClient(null);
    setIsConnected(false);
    setSearchResults([]);
  };

  const handleSearch = async (query: string) => {
    if (!client) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      console.log('Searching for:', query);
      const results = await client.search(query);
      console.log('Search results:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage =
        error instanceof Error
          ? `Search failed: ${error.message}`
          : 'Search failed';
      setSearchError(errorMessage);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <CallimachusTitlebar
        isConnected={isConnected}
        onRefresh={() => {
          // Refresh connection by testing it again
          if (client) {
            const savedSettings = localStorage.getItem('callimachus-settings');
            if (savedSettings) {
              handleConnect(JSON.parse(savedSettings));
            }
          }
        }}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <ConnectionPanel
          isConnected={isConnected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          error={connectionError}
        />

        {isConnected && (
          <>
            <SearchInterface
              onSearch={handleSearch}
              isSearching={isSearching}
              error={searchError}
            />

            <ResultsDisplay results={searchResults} isLoading={isSearching} />
          </>
        )}
      </div>
    </div>
  );
};

export default CallimachusWindow;
