import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import {
    Loader2, Camera, CheckCircle2, Target,
    Upload, Send, Eye, Image as ImageIcon, Layout,
    BarChart3, List, Home, XCircle, Flame, RotateCcw, Activity
} from 'lucide-react';
import simpleheat from 'simpleheat';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import webgazer from 'webgazer';

// Note: We avoid direct patching of faceLandmarksDetection.load here 
// because ESM imports are read-only and cause TypeErrors in some environments.

// Fix for WebGazer's internal tracker CORS issues
class ModernTracker {
    detector: any = null;
    predictionReady = false;
    positionsArray: any = null;
    name = 'TFFacemesh'; // Replace the default one

    async init() {
        console.log('Initializing Modern FaceMesh Tracker...');
        try {
            this.detector = await faceLandmarksDetection.createDetector(
                faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                {
                    runtime: 'mediapipe',
                    solutionPath: '/mediapipe/face_mesh',
                    refineLandmarks: false // This MUST be false to avoid Iris model CORS issues
                }
            );
            console.log('Modern Tracker Ready.');
        } catch (err) {
            console.error('Modern Tracker Init failed:', err);
            throw err;
        }
    }

    async getEyePatches(video: HTMLVideoElement, imageCanvas: HTMLCanvasElement) {
        if (!this.detector) await this.init();

        if (imageCanvas.width === 0) return null;

        const predictions = await this.detector.estimateFaces(video, {
            flipHorizontal: false,
            staticImageMode: false
        });

        if (!predictions || predictions.length === 0) return false;

        const face = predictions[0];
        // The mesh format is different in current version, we need to adapt it
        // WebGazer expects scaledMesh (array of [x, y, z])
        this.positionsArray = face.keypoints.map((p: any) => [p.x, p.y, p.z || 0]);

        // We need annotations for eyes. In new version they are just keypoints.
        // Left eye: 33, 133, 157, 158, 159, 160, 161, 246 (approx)
        // Better: use the indices from mediapipe
        // For simplicity, we can try to map them or use a subset

        const getBBox = (keypoints: any[]) => {
            const xs = keypoints.map(p => p.x);
            const ys = keypoints.map(p => p.y);
            return {
                x: Math.min(...xs),
                y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
            };
        };

        // Extracting eyes based on well known indices
        // Left Eye: 33, 160, 158, 133, 153, 144
        // Right Eye: 362, 385, 387, 263, 373, 380
        const leftEyeIndices = [33, 160, 158, 133, 153, 144];
        const rightEyeIndices = [362, 385, 387, 263, 373, 380];

        const leftEyeKps = leftEyeIndices.map(i => face.keypoints[i]);
        const rightEyeKps = rightEyeIndices.map(i => face.keypoints[i]);

        const leftBBox = getBBox(leftEyeKps);
        const rightBBox = getBBox(rightEyeKps);

        if (leftBBox.width === 0 || rightBBox.width === 0) return null;

        const ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;

        const eyeObjs: any = {
            left: {
                patch: ctx.getImageData(leftBBox.x, leftBBox.y, leftBBox.width, leftBBox.height),
                imagex: leftBBox.x,
                imagey: leftBBox.y,
                width: leftBBox.width,
                height: leftBBox.height
            },
            right: {
                patch: ctx.getImageData(rightBBox.x, rightBBox.y, rightBBox.width, rightBBox.height),
                imagex: rightBBox.x,
                imagey: rightBBox.y,
                width: rightBBox.width,
                height: rightBBox.height
            }
        };

        this.predictionReady = true;
        return eyeObjs;
    }

    getPositions() {
        return this.positionsArray;
    }

    reset() { }

    drawFaceOverlay(ctx: any, keypoints: any) {
        if (!keypoints) return;
        ctx.fillStyle = '#32EEDB';
        keypoints.forEach((kp: any) => {
            ctx.beginPath();
            ctx.arc(kp[0], kp[1], 1, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}

// No need for window.webgazer anymore as we import it,
// but we keep the declaration just in case of global leftovers
declare global {
    interface Window {
        webgazer: any;
    }
}

// LOBOTOMY: Completely hijack all WebGazer tracker modules to prevent any external fetches
if (webgazer && (webgazer as any).addTrackerModule) {
    const trackerNames = ['TFFacemesh', 'clmtrackr', 'trackingjs'];
    trackerNames.forEach(name => {
        webgazer.addTrackerModule(name, ModernTracker as any);
    });
}

const CALIBRATION_POINTS = [
    { id: 1, x: 10, y: 10 }, { id: 2, x: 50, y: 10 }, { id: 3, x: 90, y: 10 },
    { id: 4, x: 10, y: 50 }, { id: 5, x: 50, y: 50 }, { id: 6, x: 90, y: 50 },
    { id: 7, x: 10, y: 90 }, { id: 8, x: 50, y: 90 }, { id: 9, x: 90, y: 90 },
];

const SessionPage = () => {
    const { id: sessionId } = useParams();
    const { user } = useAuth();
    const socket = useSocket();

    // Common State
    const [status, setStatus] = useState<'waiting' | 'ready' | 'calibrating' | 'completed' | 'tracking' | 'summary'>('waiting');
    const [error, setError] = useState('');
    const [summaryData, setSummaryData] = useState<any>(null);

    // User State
    const [calibrationPoints, setCalibrationPoints] = useState<number>(0);
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const [localGaze, setLocalGaze] = useState<{ x: number, y: number } | null>(null);
    const calibrationPointsRef = useRef<number>(0);

    // Admin State
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [userCalibrated, setUserCalibrated] = useState(false);
    const [isAdminStarting, setIsAdminStarting] = useState(false);
    const [remoteGaze, setRemoteGaze] = useState<{ x: number, y: number } | null>(null);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [showScanPath, setShowScanPath] = useState(false); // Default to false as requested
    const [showSidebar, setShowSidebar] = useState(true);
    const [calibrationPhase, setCalibrationPhase] = useState<'initializing' | 'aligning' | 'active'>('initializing');
    const calibrationPhaseRef = useRef(calibrationPhase);

    // Keep ref in sync with state for access inside timers/callbacks
    useEffect(() => {
        calibrationPhaseRef.current = calibrationPhase;
    }, [calibrationPhase]);

    const [faceDetected, setFaceDetected] = useState(false);
    const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
    const heatmapInstanceRef = useRef<any>(null);
    const scanPathCanvasRef = useRef<HTMLCanvasElement>(null);
    const scanPathPointsRef = useRef<{ x: number, y: number }[]>([]);

    const showHeatmapRef = useRef(showHeatmap);
    const showScanPathRef = useRef(showScanPath);

    useEffect(() => {
        showHeatmapRef.current = showHeatmap;
    }, [showHeatmap]);

    useEffect(() => {
        showScanPathRef.current = showScanPath;
    }, [showScanPath]);

    useEffect(() => {
        if (socket && sessionId) {
            const join = () => {
                console.log('Sending join_session for:', sessionId);
                socket.emit('join_session', sessionId);
            };

            if (socket.connected) {
                join();
            }

            socket.on('connect', join);

            socket.on('init_calibration', () => {
                console.log('Received init_calibration');
                if (user?.role === 'user') setStatus('ready');
            });

            socket.on('user_calibrated', () => {
                console.log('Received user_calibrated');
                if (user?.role === 'admin') {
                    setUserCalibrated(true);
                    setIsAdminStarting(false);
                }
            });

            socket.on('new_image', (imageUrl: string) => {
                console.log('Received new_image, length:', imageUrl.length);
                if (user?.role === 'user') {
                    setCurrentImage(imageUrl);
                    setStatus('tracking');
                    // No need to resume, we'll keep it running but control flow via statusRef
                }
            });

            socket.on('receive_gaze', (data: { x: number, y: number }) => {
                if (user?.role === 'admin') {
                    setRemoteGaze(data);

                    // Add to heatmap
                    if (heatmapInstanceRef.current && heatmapCanvasRef.current) {
                        const canvas = heatmapCanvasRef.current;
                        const x = (data.x / 100) * canvas.width;
                        const y = (data.y / 100) * canvas.height;
                        heatmapInstanceRef.current.add([x, y, 1]);
                        if (showHeatmapRef.current) {
                            heatmapInstanceRef.current.draw();
                        }
                    }

                    // Add to scan path - ONLY IF NEAR CALIBRATION POINTS
                    if (scanPathCanvasRef.current) {

                        // Find if gazing near any calibration point (radius 7%)
                        const nearestPoint = CALIBRATION_POINTS.find(p => {
                            const dist = Math.sqrt(Math.pow(p.x - data.x, 2) + Math.pow(p.y - data.y, 2));
                            return dist < 8; // 8% proximity radius
                        });

                        if (nearestPoint) {
                            const lastPoint = scanPathPointsRef.current[scanPathPointsRef.current.length - 1];

                            // Only add if it's a different point than the last one recorded
                            if (!lastPoint || (lastPoint as any).id !== nearestPoint.id) {
                                scanPathPointsRef.current.push({
                                    ...nearestPoint,
                                    timestamp: Date.now()
                                } as any);

                                if (showScanPathRef.current) {
                                    redrawScanPath();
                                }
                            }
                        }
                    }
                }
            });

            socket.on('session_ended', (data: any) => {
                console.log('Session ended:', data);
                setSummaryData(data);
                setStatus('summary');
                if (webgazer) {
                    try {
                        webgazer.end();
                        // Force stop camera tracks
                        const video = document.getElementById('webgazerVideoPreview') as HTMLVideoElement;
                        if (video && video.srcObject) {
                            const stream = video.srcObject as MediaStream;
                            stream.getTracks().forEach(track => track.stop());
                        }
                        const container = document.getElementById('webgazerVideoContainer');
                        if (container) container.style.display = 'none';
                    } catch (e) { }
                }
            });

            return () => {
                socket.off('connect', join);
                socket.off('init_calibration');
                socket.off('user_calibrated');
                socket.off('new_image');
                socket.off('receive_gaze');
                socket.off('session_ended');
                if (webgazer) {
                    try {
                        webgazer.end();
                        const video = document.getElementById('webgazerVideoPreview') as HTMLVideoElement;
                        if (video && video.srcObject) {
                            const stream = video.srcObject as MediaStream;
                            stream.getTracks().forEach(track => track.stop());
                        }
                    } catch (e) {
                        console.error('Error ending WebGazer', e);
                    }
                }
            };
        }
    }, [socket, sessionId, user?.role]);

    // --- User Functions ---
    const [, setWebgazerLoading] = useState(false);

    const startCalibration = async () => {
        try {
            setError('');
            setWebgazerLoading(true);
            setStatus('calibrating');

            // Set TFJS backend explicitly to avoid some issues
            await tf.setBackend('webgl');

            initWebGazer();
        } catch (err) {
            console.error('Calibration start error:', err);
            setError('خطا در دسترسی به دوربین یا ردیاب');
            setWebgazerLoading(false);
            setStatus('ready');
        }
    };

    const statusRef = useRef(status);
    const socketRef = useRef(socket);
    const sessionIdRef = useRef(sessionId);

    useEffect(() => {
        statusRef.current = status;
        socketRef.current = socket;
        sessionIdRef.current = sessionId;
    }, [status, socket, sessionId]);

    const initWebGazer = () => {
        console.log('Initializing WebGazer (NPM with Modern Tracker)...');
        let firstPredictionReceived = false;

        // Ensure webgazer is available (from import)
        const tracker = webgazer;

        // Register and set the tracker
        tracker.addTrackerModule('ModernTracker', function () {
            return new ModernTracker() as any;
        });
        tracker.setTracker('ModernTracker');

        tracker.setGazeListener((data: any) => {
            if (data && !firstPredictionReceived) {
                firstPredictionReceived = true;
                setFaceDetected(true);
            }
            if (data) {
                if ((statusRef.current === 'tracking' || statusRef.current === 'calibrating') && socketRef.current && sessionIdRef.current) {
                    const x = (data.x / window.innerWidth) * 100;
                    const y = (data.y / window.innerHeight) * 100;

                    setLocalGaze({ x, y });

                    socketRef.current.emit('gaze_data', {
                        sessionId: sessionIdRef.current,
                        x,
                        y
                    });
                }
            }
        });

        tracker.saveDataAcrossSessions(false);
        console.log('WebGazer save data disabled to avoid storage blocks.');

        // Safety net: If begin() takes too long (common due to CORS errors in background), force proceed
        const safetyTimeout = setTimeout(() => {
            console.warn('WebGazer.begin() timeout - forcing transition to alignment');
            if (calibrationPhaseRef.current === 'initializing') {
                proceedToAligning();
            }
        }, 10000); // 10 seconds safety

        const proceedToAligning = () => {
            if (calibrationPhaseRef.current !== 'initializing') return;

            clearTimeout(safetyTimeout);
            console.log('Proceeding to Aligning phase...');
            setCalibrationPhase('aligning');
            setWebgazerLoading(false);

            // Give user 5 seconds to align face
            setTimeout(() => {
                const vc = document.getElementById('webgazerVideoContainer');
                if (vc) {
                    vc.style.transition = 'opacity 1s ease-out';
                    vc.style.opacity = '0';
                    setTimeout(() => {
                        vc.style.display = 'none';
                        setCalibrationPhase('active');
                    }, 1000);
                } else {
                    setCalibrationPhase('active');
                }
            }, 5000);
        };

        tracker.begin().then(() => {
            console.log('WebGazer started successfully.');
            tracker.showPredictionPoints(true)
                .applyKalmanFilter(true);

            // Style and show video preview
            const videoContainer = document.getElementById('webgazerVideoContainer');
            if (videoContainer) {
                videoContainer.style.setProperty('display', 'block', 'important');
                videoContainer.style.setProperty('opacity', '1', 'important');
                videoContainer.style.setProperty('top', '20px', 'important');
                videoContainer.style.setProperty('left', '20px', 'important');
                videoContainer.style.setProperty('width', '320px', 'important');
                videoContainer.style.setProperty('height', '240px', 'important');
                videoContainer.style.setProperty('border-radius', '24px', 'important');
                videoContainer.style.setProperty('border', '4px solid #3b82f6', 'important');
                videoContainer.style.setProperty('z-index', '9999', 'important');
                videoContainer.style.setProperty('overflow', 'hidden', 'important'); // Prevents video from spilling out
                videoContainer.style.setProperty('box-shadow', '0 25px 50px -12px rgba(0, 0, 0, 0.5)', 'important');
            }

            proceedToAligning();

        }).catch((e: any) => {
            console.error('WebGazer Begin Error (usually safe to ignore if local models loaded):', e);
            // Even if it fails (due to CORS in the old tracker), our modern one might be working
            // So we try to proceed anyway after a short delay
            setTimeout(proceedToAligning, 1000);
        });
    };

    const handlePointClick = (pointId: number) => {
        const btn = document.getElementById(`point-${pointId}`);
        if (btn) btn.style.display = 'none';

        calibrationPointsRef.current += 1;
        setCalibrationPoints(calibrationPointsRef.current);

        if (calibrationPointsRef.current === 9) {
            setStatus('completed');
            socket?.emit('calibration_done', sessionId);
            // Don't pause webgazer, just change the status
            if (webgazer) {
                webgazer.showPredictionPoints(false);
                webgazer.showVideoPreview(false);
                const videoContainer = document.getElementById('webgazerVideoContainer');
                if (videoContainer) videoContainer.style.display = 'none';
            }
        }
    };

    // --- Visualization Logic (Heatmap & Scan Path) ---
    useEffect(() => {
        if (user?.role !== 'admin') return;

        const initCanvases = () => {
            if (heatmapCanvasRef.current) {
                const canvas = heatmapCanvasRef.current;
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;

                const heatFunc = (simpleheat as any).default || simpleheat;
                const heat = heatFunc(canvas);
                heat.radius(45, 25);
                heat.max(5);
                heatmapInstanceRef.current = heat;
                if (showHeatmap) heat.draw();
            }

            if (scanPathCanvasRef.current) {
                const canvas = scanPathCanvasRef.current;
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                redrawScanPath();
            }
        };

        initCanvases();
        window.addEventListener('resize', initCanvases);
        return () => window.removeEventListener('resize', initCanvases);
    }, [user?.role, currentImage]);

    const redrawScanPath = () => {
        if (scanPathCanvasRef.current) {
            const canvas = scanPathCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx && scanPathPointsRef.current.length > 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';

                const points = scanPathPointsRef.current;
                ctx.moveTo((points[0].x / 100) * canvas.width, (points[0].y / 100) * canvas.height);

                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo((points[i].x / 100) * canvas.width, (points[i].y / 100) * canvas.height);
                }
                ctx.stroke();

                // Draw dots at each point
                points.forEach(p => {
                    ctx.beginPath();
                    ctx.arc((p.x / 100) * canvas.width, (p.y / 100) * canvas.height, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#3b82f6';
                    ctx.fill();
                });
            }
        }
    };

    const toggleHeatmap = () => {
        const newState = !showHeatmap;
        setShowHeatmap(newState);
        if (newState && heatmapInstanceRef.current) {
            heatmapInstanceRef.current.draw();
        }
    };

    const toggleScanPath = () => {
        const newState = !showScanPath;
        setShowScanPath(newState);
        if (newState) {
            redrawScanPath();
        }
    };

    const resetHeatmap = () => {
        if (heatmapInstanceRef.current) {
            heatmapInstanceRef.current.data([]);
            heatmapInstanceRef.current.draw();
        }
    };

    const resetScanPath = () => {
        scanPathPointsRef.current = [];
        if (scanPathCanvasRef.current) {
            const ctx = scanPathCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, scanPathCanvasRef.current.width, scanPathCanvasRef.current.height);
        }
    };

    const toggleSidebar = () => {
        setShowSidebar(!showSidebar);
    };
    const handleAdminStart = () => {
        setIsAdminStarting(true);
        socket?.emit('start_calibration', sessionId);
        setStatus('waiting'); // Waiting for user to finish
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    setUploadedImages(prev => [...prev, event.target!.result as string]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const sendImageToUser = (imageUrl: string) => {
        socket?.emit('send_image', { sessionId, imageUrl });
        setCurrentImage(imageUrl); // Admin also sees what they sent
        resetHeatmap();
        resetScanPath();
    };

    const handleEndSession = () => {
        if (window.confirm('آیا از اتمام جلسه و ذخیره نتایج اطمینان دارید؟')) {
            socket?.emit('end_session', sessionId);
        }
    };

    // --- Rendering Logic ---

    if (status === 'summary') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col font-['Vazirmatn'] text-right">
                <header className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><BarChart3 className="w-6 h-6" /></div>
                        <h1 className="text-2xl font-black text-slate-800">گزارش نهایی جلسه</h1>
                    </div>
                    <button onClick={() => window.location.href = user?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">
                        بازگشت به داشبورد
                        <Home className="w-4 h-4" />
                    </button>
                </header>

                <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4"><ImageIcon className="w-6 h-6" /></div>
                            <span className="text-slate-400 font-bold mb-1">تعداد تصاویر تست</span>
                            <span className="text-3xl font-black text-slate-800">{summaryData?.results?.length || 0}</span>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4"><Target className="w-6 h-6" /></div>
                            <span className="text-slate-400 font-bold mb-1">نقاط ردیابی شده</span>
                            <span className="text-3xl font-black text-slate-800">
                                {summaryData?.results?.reduce((acc: number, res: any) => acc + (res.gazePoints?.length || 0), 0)}
                            </span>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center">
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4"><CheckCircle2 className="w-6 h-6" /></div>
                            <span className="text-slate-400 font-bold mb-1">وضعیت نهایی</span>
                            <span className="text-3xl font-black text-slate-800">تکمیل شده</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                لیست تصاویر و نقاط نگاه
                                <List className="w-5 h-5 text-blue-600" />
                            </h2>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {summaryData?.results?.map((res: any, idx: number) => (
                                <div key={idx} className="group space-y-4">
                                    <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-slate-50 shadow-md group-hover:shadow-xl transition-all">
                                        <img src={res.imageUrl} className="w-full h-full object-cover" />

                                        {/* Tracked Gaze Points (Red Dots) */}
                                        {res.gazePoints?.map((p: any, pIdx: number) => (
                                            <div
                                                key={pIdx}
                                                className="absolute w-1.5 h-1.5 bg-red-500 rounded-full opacity-40 shadow-[0_0_4px_rgba(239,44,44,0.5)]"
                                                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between px-2">
                                        <span className="font-black text-slate-700">تصویر شماره {idx + 1}</span>
                                        <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-black">
                                            {res.gazePoints?.length || 0} نقطه ردیابی
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (user?.role === 'admin') {
        return (
            <div className="min-h-screen bg-black flex font-['Vazirmatn'] text-right overflow-hidden relative">
                {/* Collapsible Sidebar Overlay */}
                <aside className={`fixed top-4 right-4 bottom-4 w-96 bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-200/50 p-8 flex flex-col shadow-2xl z-[100] transition-all duration-500 ease-in-out overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 ${showSidebar ? 'translate-x-0 opacity-100' : 'translate-x-[110%] opacity-0 pointer-events-none'
                    }`}>
                    <div className="flex items-center gap-3 mb-10 justify-end">
                        <span className="font-black text-xl text-slate-900">کنترل پنل مدیر</span>
                        <div className="bg-blue-600 p-2 rounded-lg text-white"><Layout className="w-5 h-5" /></div>
                    </div>

                    {!userCalibrated ? (
                        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl mb-8">
                            <p className="text-amber-700 font-bold mb-4">وضعیت: {isAdminStarting ? 'در انتظار شروع توسط کاربر' : 'در انتظار کالیبراسیون'}</p>
                            <button
                                onClick={handleAdminStart}
                                disabled={isAdminStarting}
                                className={`w-full py-4 rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 ${isAdminStarting ? 'bg-amber-100 text-amber-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'}`}
                            >
                                {isAdminStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                                {isAdminStarting ? 'در حال ارسال دستور...' : 'شروع کالیبراسیون کاربر'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl mb-8">
                            <p className="text-emerald-700 font-bold flex items-center gap-2 justify-end">
                                کالیبراسیون کاربر تکمیل شد
                                <CheckCircle2 className="w-5 h-5" />
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col">
                        <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2 justify-end">
                            آپلود تصاویر تست
                            <ImageIcon className="w-4 h-4 text-blue-600" />
                        </h4>

                        <label className="border-2 border-dashed border-slate-200 rounded-2xl p-6 hover:bg-slate-50 transition-all cursor-pointer flex flex-col items-center gap-2 mb-6 group flex-shrink-0">
                            <Upload className="w-8 h-8 text-slate-300 group-hover:text-blue-500 transition-colors" />
                            <span className="text-sm text-slate-500 font-bold">انتخاب تصاویر</span>
                            <input type="file" multiple className="hidden" onChange={handleImageUpload} accept="image/*" />
                        </label>

                        <div className="space-y-4">
                            {uploadedImages.length === 0 && (
                                <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                                    <p className="text-xs font-bold">هنوز تصویری آپلود نشده است</p>
                                </div>
                            )}
                            {uploadedImages.map((img, idx) => (
                                <div key={idx} className="relative rounded-2xl overflow-hidden border border-slate-100 h-48 w-full shadow-sm hover:shadow-md transition-all group">
                                    <img src={img} className="w-full h-full object-cover" alt={`Upload ${idx}`} />
                                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                        <button
                                            onClick={() => sendImageToUser(img)}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-all"
                                        >
                                            <Send className="w-4 h-4" />
                                            ارسال به کاربر
                                        </button>
                                    </div>
                                    <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-900 border border-slate-200 shadow-sm z-10 transition-transform group-hover:scale-105">
                                        تصویر {idx + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="py-8 border-t border-slate-100 space-y-4">
                        <div className="grid grid-cols-2 gap-3 pb-4">
                            <button
                                onClick={toggleHeatmap}
                                className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${showHeatmap
                                    ? 'bg-orange-100 text-orange-600 border border-orange-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                    }`}
                            >
                                <Flame className="w-4 h-4" />
                                {showHeatmap ? 'عدم نمایش هیت‌مپ' : 'نمایش هیت‌مپ'}
                            </button>
                            <button
                                onClick={toggleScanPath}
                                className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${showScanPath
                                    ? 'bg-blue-100 text-blue-600 border border-blue-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                    }`}
                            >
                                <Activity className="w-4 h-4" />
                                {showScanPath ? 'عدم نمایش اسکن پس' : 'نمایش اسکن پس'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={resetHeatmap}
                                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold border border-slate-200 flex items-center justify-center gap-2 transition-all"
                            >
                                <RotateCcw className="w-4 h-4" />
                                ریست هیت‌مپ
                            </button>
                            <button
                                onClick={resetScanPath}
                                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold border border-slate-200 flex items-center justify-center gap-2 transition-all"
                            >
                                <RotateCcw className="w-4 h-4" />
                                ریست اسکن پس
                            </button>
                        </div>
                        <button
                            onClick={handleEndSession}
                            className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-xl shadow-red-500/20 transition-all flex items-center justify-center gap-3"
                        >
                            <XCircle className="w-6 h-6" />
                            اتمام نهایی جلسه و ذخیره نتایج
                        </button>
                    </div>
                </aside>

                {/* Sidebar Toggle Button */}
                <div className="fixed bottom-10 right-10 z-[110]">
                    <button
                        onClick={toggleSidebar}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-3xl shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center border-4 border-white/20"
                    >
                        {showSidebar ? <XCircle className="w-8 h-8" /> : <Layout className="w-8 h-8" />}
                    </button>
                </div>

                {/* Tracking Preview - FULLSCREEN */}
                <main className="fixed inset-0 bg-black flex items-center justify-center z-10">
                    {currentImage || (!userCalibrated && status === 'waiting') ? (
                        <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                            {currentImage ? (
                                <img src={currentImage} className="w-full h-full object-cover" alt="Admin Preview" />
                            ) : (
                                <div className="w-full h-full relative overflow-hidden bg-slate-900 flex items-center justify-center">
                                    <div className="text-center z-10">
                                        <h3 className="text-white font-black text-2xl mb-2 opacity-20">کالیبراسیون در حال انجام است</h3>
                                        <p className="text-white/10 font-bold">مشاهده مسیر حرکت چشم کاربر بین نقاط</p>
                                    </div>
                                    {/* Show calibration points to admin for context */}
                                    {CALIBRATION_POINTS.map(p => (
                                        <div
                                            key={p.id}
                                            className={`absolute w-8 h-8 border-2 border-white/20 rounded-full flex items-center justify-center z-10 opacity-30`}
                                            style={{
                                                left: `${p.x}%`,
                                                top: `${p.y}%`,
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                        >
                                            <div className="w-2 h-2 bg-white/40 rounded-full" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Heatmap Overlay Canvas */}
                            <canvas
                                ref={heatmapCanvasRef}
                                className={`absolute inset-0 z-40 pointer-events-none transition-opacity duration-300 ${showHeatmap ? 'opacity-100' : 'opacity-0'}`}
                            />

                            {/* Scan Path Overlay Canvas */}
                            <canvas
                                ref={scanPathCanvasRef}
                                className={`absolute inset-0 z-[45] pointer-events-none transition-opacity duration-300 ${showScanPath ? 'opacity-100' : 'opacity-0'}`}
                            />

                            {remoteGaze && (
                                <div
                                    className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
                                    style={{
                                        left: `${remoteGaze.x}%`,
                                        top: `${remoteGaze.y}%`,
                                        background: 'radial-gradient(circle, rgba(2, 6, 23, 1) 0%, rgba(2, 6, 23, 0.8) 30%, rgba(2, 6, 23, 0.4) 60%, rgba(2, 6, 23, 0) 85%)',
                                        borderRadius: '50%',
                                        transition: 'all 0.1s ease-out',
                                        boxShadow: '0 0 40px rgba(0,0,0,0.6)',
                                        border: '2px solid rgba(255,255,255,0.2)'
                                    }}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="text-center space-y-4">
                            <div className="bg-white/10 backdrop-blur-xl p-16 rounded-[48px] border border-white/10 shadow-2xl">
                                <Eye className="w-24 h-24 text-white/20 mx-auto mb-6" />
                                <h2 className="text-3xl font-black text-white">در انتظار مشاهده تصویر</h2>
                                <p className="text-white/40 mt-4 text-lg">تصویری را از پنل کنترل ارسال کنید</p>
                            </div>
                        </div>
                    )}

                    {remoteGaze && (
                        <div className="fixed bottom-10 left-10 px-6 py-3 bg-emerald-500/90 backdrop-blur-md text-white rounded-2xl text-sm font-black animate-pulse z-20 shadow-xl">
                            Live Stream Active
                        </div>
                    )}

                    <div className="fixed top-10 left-10 px-4 py-2 bg-slate-900/80 backdrop-blur-md text-white rounded-2xl text-xs font-bold flex items-center gap-3 z-30 border border-white/10">
                        <div className={`w-2.5 h-2.5 rounded-full ${socket?.connected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                        {socket?.connected ? 'CONNECTED' : 'DISCONNECTED'}
                    </div>
                </main>
            </div>
        );
    }

    // --- User View ---
    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center font-['Vazirmatn'] relative overflow-hidden">
            {status === 'waiting' && (
                <div className="text-center space-y-8 animate-in fade-in duration-700">
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 border border-white/10 mb-4">
                        <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
                    </div>
                    <h1 className="text-4xl font-black">در انتظار مدیر...</h1>
                    <p className="text-slate-400 text-lg">لطفاً تا شروع کالیبراسیون توسط مدیر منتظر بمانید.</p>
                </div>
            )}

            {status === 'ready' && (
                <div className="text-center space-y-8 animate-in zoom-in duration-500 max-w-md">
                    <Camera className="h-20 w-20 text-emerald-400 mx-auto mb-4" />
                    <h1 className="text-4xl font-black">شروع تست ردیابی</h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        مدیر اجازه شروع تست را صادر کرد. آماده‌اید؟
                        <br />
                        ابتدا کالیبراسیون ۹ نقطه‌ای را انجام می‌دهیم.
                    </p>
                    <button
                        onClick={startCalibration}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black shadow-xl transition-all"
                    >
                        شروع کالیبراسیون
                    </button>
                    {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
                </div>
            )}

            {status === 'calibrating' && (
                <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center">
                    {calibrationPhase === 'initializing' && (
                        <div className="text-center space-y-6">
                            <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 border border-white/10 mb-4">
                                <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
                            </div>
                            <h2 className="text-2xl font-black">در حال آماده‌سازی ردیاب...</h2>
                            <p className="text-slate-400">لطفا چند ثانیه صبر کنید.</p>
                        </div>
                    )}

                    {calibrationPhase === 'aligning' && (
                        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500 max-w-lg px-6">
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                                <div className="relative bg-blue-600 rounded-full w-full h-full flex items-center justify-center shadow-xl shadow-blue-500/30">
                                    <Camera className="w-12 h-12 text-white" />
                                </div>
                            </div>
                            <h2 className="text-3xl font-black text-white">تنظیم وضعیت صورت</h2>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                لطفاً صورت خود را در کادر کوچک سمت چپ تنظیم کنید.
                                <br />
                                <span className="text-blue-400 font-bold">کالیبراسیون به زودی شروع می‌شود...</span>
                            </p>
                            {faceDetected ? (
                                <div className="bg-emerald-500/20 text-emerald-400 px-6 py-2 rounded-full font-bold inline-block border border-emerald-500/30">
                                    صورت شناسایی شد ✓
                                </div>
                            ) : (
                                <div className="bg-amber-500/20 text-amber-400 px-6 py-2 rounded-full font-bold inline-block border border-amber-500/30">
                                    در حال جستجوی صورت...
                                </div>
                            )}
                        </div>
                    )}

                    {calibrationPhase === 'active' && (
                        <>
                            <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center z-10 bg-slate-900/80 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                                <p className="text-blue-400 font-black text-xl mb-1">کالیبراسیون دقیق ({calibrationPoints}/9)</p>
                                <p className="text-slate-400 text-sm mb-4">روی نقاط قرمز کلیک کنید و با چشم آن‌ها را تعقیب کنید.</p>
                                <div className="flex flex-col gap-2 text-[12px] text-amber-400 font-bold bg-amber-400/10 p-3 rounded-xl border border-amber-400/20">
                                    <p>۱. نزدیک دوربین شوید و سر خود را ثابت نگه دارید.</p>
                                    <p>۲. به نقاط نگاه کرده و سپس کلیک کنید.</p>
                                </div>
                            </div>
                            {CALIBRATION_POINTS.map(p => (
                                <button
                                    key={p.id}
                                    id={`point-${p.id}`}
                                    onClick={() => handlePointClick(p.id)}
                                    className={`absolute w-10 h-10 bg-red-600 rounded-full shadow-[0_0_25px_rgba(220,38,38,0.6)] hover:scale-125 transition-all animate-pulse z-20 flex items-center justify-center`}
                                    style={{
                                        left: `${p.x}%`,
                                        top: `${p.y}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                >
                                    <div className="w-3 h-3 bg-white rounded-full" />
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}

            {status === 'completed' && (
                <div className="text-center space-y-8 animate-in bounce-in duration-700">
                    <CheckCircle2 className="h-20 w-20 text-emerald-400 mx-auto mb-4" />
                    <h1 className="text-4xl font-black">کالیبراسیون با موفقیت انجام شد!</h1>
                    <p className="text-slate-400 text-lg">لطفاً منتظر بمانید تا مدیر اولین تصویر را برای شما ارسال کند.</p>
                </div>
            )}

            {status === 'tracking' && currentImage && (
                <div className="fixed inset-0 bg-black flex items-center justify-center z-40">
                    <img src={currentImage} className="w-full h-full object-cover" alt="Tracking Target" />

                    {/* Floating User Preview - Larger & Matched Style */}
                    <div className="fixed bottom-10 left-10 w-96 aspect-video bg-slate-900/90 rounded-[32px] border-4 border-white/20 overflow-hidden shadow-2xl z-50 backdrop-blur-md">
                        <div className="absolute top-4 left-6 px-3 py-1 bg-blue-600 text-[10px] font-black tracking-widest text-white rounded-full z-10 shadow-lg">LIVE ADMIN VIEW MIRROR</div>
                        <img src={currentImage} className="w-full h-full object-cover opacity-40 scale-105" />
                        {localGaze && (
                            <div
                                className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                style={{
                                    left: `${localGaze.x}%`,
                                    top: `${localGaze.y}%`,
                                    background: 'radial-gradient(circle, rgba(2, 6, 23, 1) 0%, rgba(2, 6, 23, 0.8) 30%, rgba(2, 6, 23, 0.4) 60%, rgba(2, 6, 23, 0) 85%)',
                                    borderRadius: '50%',
                                    boxShadow: '0 0 30px rgba(0,0,0,0.5)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            />
                        )}
                    </div>

                    <div className="fixed top-4 right-4 bg-slate-900/90 px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-3 backdrop-blur-md border border-white/10 shadow-2xl">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </div>
                        <span className="font-bold tracking-wider">LIVE TRACKING ACTIVE</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionPage;
