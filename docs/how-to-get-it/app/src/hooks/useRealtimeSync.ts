import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// ============================================
// REAL-TIME SYNC HOOK
// ============================================
// WebSocket connection that keeps data synchronized
// across all clients in real-time
// 
// When another user makes changes, this hook:
// 1. Receives the WebSocket message
// 2. Invalidates the relevant query cache
// 3. Triggers a background refetch
// 4. UI updates automatically with fresh data
// ============================================

interface WebSocketMessage {
  type: string;
  table?: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE';
  data?: any;
}

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[RealtimeSync] Connected to WebSocket');
      
      // Subscribe to all tables
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        tables: ['products', 'sales_orders', 'customers']
      }));

      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('[RealtimeSync] Received:', message.type, message.table || '');

        switch (message.type) {
          case 'DATA_CHANGED':
            // Invalidate the relevant query cache based on table
            if (message.table === 'products') {
              // Invalidate all product lists
              queryClient.invalidateQueries({
                queryKey: queryKeys.products.all,
                refetchType: 'active', // Only refetch active queries
              });
            } else if (message.table === 'sales_orders') {
              queryClient.invalidateQueries({
                queryKey: queryKeys.salesOrders.all,
                refetchType: 'active',
              });
              // Also invalidate stats since orders affect stats
              queryClient.invalidateQueries({
                queryKey: queryKeys.stats.all,
                refetchType: 'active',
              });
            } else if (message.table === 'customers') {
              queryClient.invalidateQueries({
                queryKey: queryKeys.customers.all,
                refetchType: 'active',
              });
            }
            break;

          case 'CONNECTED':
            console.log('[RealtimeSync] Client ID:', message.data?.clientId);
            break;

          case 'PONG':
            // Heartbeat acknowledged
            break;
        }
      } catch (error) {
        console.error('[RealtimeSync] Error processing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[RealtimeSync] Disconnected, reconnecting in 3s...');
      
      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('[RealtimeSync] WebSocket error:', error);
    };
  }, [queryClient]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
