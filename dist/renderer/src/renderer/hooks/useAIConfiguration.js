import { useState, useEffect } from 'react';
export function useAIConfiguration() {
    const [aiConfig, setAIConfig] = useState({
        available: false,
        loading: true,
    });
    const checkAIConfiguration = async () => {
        try {
            setAIConfig((prev) => ({ ...prev, loading: true }));
            const result = await window.electron.layerValidation.checkAIConfiguration();
            if (result.success) {
                setAIConfig({
                    ...result.data,
                    loading: false,
                });
            }
            else {
                setAIConfig({
                    available: false,
                    error: result.error || 'Failed to check AI configuration',
                    suggestion: 'Check AI service configuration',
                    loading: false,
                });
            }
        }
        catch (error) {
            setAIConfig({
                available: false,
                error: error.message || 'Failed to check AI configuration',
                suggestion: 'Check AI service configuration',
                loading: false,
            });
        }
    };
    useEffect(() => {
        checkAIConfiguration();
    }, []);
    return {
        aiConfig,
        checkAIConfiguration,
        isAIAvailable: aiConfig.available && !aiConfig.loading,
    };
}
