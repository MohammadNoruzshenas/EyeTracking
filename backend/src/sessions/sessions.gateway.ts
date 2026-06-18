import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionsService } from './sessions.service';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    maxHttpBufferSize: 1e7, // 10MB
})
export class SessionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private connectedClients: Map<string, string> = new Map(); // userId -> socketId
    // sessionResults: sessionId -> { imageUrl -> gazePoints[] }
    private sessionData: Map<string, { currentImage: string, results: Map<string, any[]> }> = new Map();

    constructor(
        private jwtService: JwtService,
        @Inject(forwardRef(() => SessionsService))
        private sessionsService: SessionsService
    ) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
            if (!token) return client.disconnect();

            const payload = await this.jwtService.verifyAsync(token, { secret: 'SECRET_KEY' });
            const userId = payload.sub;

            this.connectedClients.set(userId, client.id);
            client.join(`user_${userId}`);
            console.log(`User connected: ${userId}`);
        } catch (e) {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        for (const [userId, socketId] of this.connectedClients.entries()) {
            if (socketId === client.id) {
                this.connectedClients.delete(userId);
                console.log(`User disconnected: ${userId}`);
                break;
            }
        }
    }

    @SubscribeMessage('join_session')
    handleJoinSession(client: Socket, sessionId: string) {
        client.join(`session_${sessionId}`);
        if (!this.sessionData.has(sessionId)) {
            this.sessionData.set(sessionId, { currentImage: '', results: new Map() });
        }
        console.log(`Socket ${client.id} joined session room: session_${sessionId}`);
    }

    @SubscribeMessage('start_calibration')
    handleStartCalibration(client: Socket, sessionId: string) {
        console.log(`Starting calibration for session: ${sessionId}`);
        this.server.to(`session_${sessionId}`).emit('init_calibration');
    }

    @SubscribeMessage('calibration_done')
    handleCalibrationDone(client: Socket, sessionId: string) {
        console.log(`Calibration done in session: ${sessionId} by ${client.id}`);
        this.server.to(`session_${sessionId}`).emit('user_calibrated', { userId: client.id });
    }

    @SubscribeMessage('send_image')
    handleSendImage(client: Socket, { sessionId, imageUrl }: { sessionId: string, imageUrl: string }) {
        console.log(`Sending image to session: ${sessionId}. Image length: ${imageUrl.length}`);

        const data = this.sessionData.get(sessionId);
        if (data) {
            data.currentImage = imageUrl;
            if (!data.results.has(imageUrl)) {
                data.results.set(imageUrl, []);
            }
        }

        this.server.to(`session_${sessionId}`).emit('new_image', imageUrl);
    }

    @SubscribeMessage('gaze_data')
    handleGazeData(client: Socket, { sessionId, x, y }: { sessionId: string, x: number, y: number }) {
        const data = this.sessionData.get(sessionId);
        if (data && data.currentImage) {
            const points = data.results.get(data.currentImage);
            if (points) {
                points.push({ x, y, timestamp: new Date(), userId: client.id });
            }
        }

        // Broadcast to admin
        client.to(`session_${sessionId}`).emit('receive_gaze', { x, y, userId: client.id });
    }

    @SubscribeMessage('end_session')
    async handleEndSession(client: Socket, sessionId: string) {
        console.log(`Ending session: ${sessionId}`);
        const data = this.sessionData.get(sessionId);

        const resultsArray: any[] = [];
        if (data) {
            data.results.forEach((points, imageUrl) => {
                resultsArray.push({ imageUrl, gazePoints: points });
            });
        }

        // Save to DB (We'll implement this method in SessionsService)
        const updatedSession = await this.sessionsService.finishSession(sessionId, resultsArray);

        // Notify all users
        this.server.to(`session_${sessionId}`).emit('session_ended', updatedSession);

        // Cleanup
        this.sessionData.delete(sessionId);
    }

    notifyInvitation(userId: string, session: any) {
        this.server.to(`user_${userId}`).emit('new_invitation', session);
    }
}
