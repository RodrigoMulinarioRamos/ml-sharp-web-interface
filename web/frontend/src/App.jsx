import { useState, useEffect, useRef, useCallback } from 'react'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'
import './App.css'

const API_URL = 'http://localhost:5001/api'

function App() {
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadedFilename, setUploadedFilename] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState('')
  const [selectedPly, setSelectedPly] = useState('')
  const [isLoadingPly, setIsLoadingPly] = useState(false)
  const [error, setError] = useState(null)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCameraButtons, setShowCameraButtons] = useState(false)
  const [showNavHelp, setShowNavHelp] = useState(false)
  
  const viewerContainerRef = useRef(null)
  const fullscreenContainerRef = useRef(null)
  const viewerRef = useRef(null)
  const fileInputRef = useRef(null)
  const progressIntervalRef = useRef(null)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    return () => {
      if (viewerRef.current) viewerRef.current.dispose()
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  // Keyboard shortcut for Reset
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!sceneLoaded) return
      if (e.key.toLowerCase() === 'r') resetCamera()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sceneLoaded])

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      
      if (data.success) {
        setUploadedFilename(data.filename)
      } else {
        setError(data.error || 'Erro ao fazer upload')
      }
    } catch (err) {
      setError('Erro de conexão com o servidor')
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      fileInputRef.current.files = dataTransfer.files
      handleImageSelect({ target: { files: dataTransfer.files } })
    }
  }, [])

  const handleDragOver = useCallback((e) => e.preventDefault(), [])

  // File input for PLY
  const plyInputRef = useRef(null)

  const loadPlyFromFile = async (file) => {
    console.log('=== loadPlyFromFile START ===')
    console.log('File name:', file.name)
    console.log('File size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
    
    setIsLoadingPly(true)
    setError(null)
    setSceneLoaded(false)
    // Don't clear selectedPly yet - let the viewer show loading state

    try {
      // Upload do arquivo PLY para o servidor
      console.log('Uploading PLY to server...')
      const formData = new FormData()
      formData.append('ply', file)

      const response = await fetch(`${API_URL}/upload-ply`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success && data.ply_file) {
        console.log('Upload successful, loading viewer with path:', data.ply_file)
        // Now set the ply file and let loadPlyViewer handle the rest
        // loadPlyViewer will set isLoadingPly=false and sceneLoaded=true when done
        setSelectedPly(data.ply_file)
        
        // Small delay to let React update the DOM
        await new Promise(resolve => setTimeout(resolve, 50))
        
        await loadPlyViewer(data.ply_file)
        console.log('=== loadPlyFromFile SUCCESS ===')
      } else {
        throw new Error(data.error || 'Erro ao fazer upload do arquivo')
      }
      
    } catch (err) {
      console.error('=== loadPlyFromFile ERROR ===')
      console.error('Error:', err.message)
      setError('Erro ao carregar o arquivo: ' + (err.message || 'erro desconhecido'))
      setIsLoadingPly(false)
      setSelectedPly('')
    }
  }

  const handlePlyFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (file && (file.name.endsWith('.ply') || file.name.endsWith('.splat'))) {
      loadPlyFromFile(file)
    }
  }

  // Handle PLY file drop on viewer
  const handleViewerDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      const fileName = file.name.toLowerCase()
      if (fileName.endsWith('.ply') || fileName.endsWith('.splat')) {
        loadPlyFromFile(file)
      }
    }
  }

  const handleViewerDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleGenerate = async () => {
    if (!uploadedFilename) {
      setError('Primeiro faça upload de uma imagem')
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationStatus('Starting...')
    setError(null)

    const estimatedTime = 20000
    const startTime = Date.now()
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min((elapsed / estimatedTime) * 95, 95)
      setGenerationProgress(progress)
      
      if (progress < 20) {
        setGenerationStatus('Initializing model...')
      } else if (progress < 50) {
        setGenerationStatus('Processing image...')
      } else if (progress < 80) {
        setGenerationStatus('Generating 3D points...')
      } else {
        setGenerationStatus('Finalizing...')
      }
    }, 200)

    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: uploadedFilename })
      })

      clearInterval(progressIntervalRef.current)

      const data = await response.json()

      if (data.success) {
        setGenerationProgress(100)
        setGenerationStatus('Complete!')
        if (data.ply_file) {
          setSelectedPly(data.ply_file)
          setTimeout(() => loadPlyViewer(data.ply_file), 500)
        }
      } else {
        setError(data.error || 'Erro ao gerar')
      }
    } catch (err) {
      clearInterval(progressIntervalRef.current)
      setError('Erro de conexão com o servidor')
    } finally {
      setTimeout(() => {
        setIsGenerating(false)
        setGenerationProgress(0)
        setGenerationStatus('')
      }, 1500)
    }
  }

  const loadPlyViewer = async (plyPath) => {
    if (!plyPath || !viewerContainerRef.current) return

    setIsLoadingPly(true)
    setError(null)
    setSceneLoaded(false)

    if (viewerRef.current) {
      try {
        viewerRef.current.dispose()
      } catch (e) {
        console.warn('Error disposing viewer:', e)
      }
      viewerRef.current = null
    }
    
    // Wait for React to finish rendering (remove placeholder)
    await new Promise(resolve => setTimeout(resolve, 100))

    if (!viewerContainerRef.current) return

    try {
      const viewer = new GaussianSplats3D.Viewer({
        cameraUp: [0, -1, 0],
        initialCameraPosition: [0, 0, -5],
        initialCameraLookAt: [0, 0, 0],
        rootElement: viewerContainerRef.current,
        sharedMemoryForWorkers: false
      })

      viewerRef.current = viewer

      await viewer.addSplatScene(`${API_URL}/ply/${plyPath}`, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: true,
        progressiveLoad: true
      })

      viewer.start()
      setSceneLoaded(true)
      
    } catch (err) {
      console.error('Error loading PLY viewer:', err)
      setError('Erro ao carregar o modelo 3D')
    } finally {
      setIsLoadingPly(false)
    }
  }

  const handleFullscreen = () => {
    fullscreenContainerRef.current?.requestFullscreen?.()
  }

  const exitFullscreen = () => {
    document.exitFullscreen?.()
  }

  const setCameraPosition = (position) => {
    if (!viewerRef.current) return
    const camera = viewerRef.current.camera
    if (!camera) return
    
    const distance = 5
    switch(position) {
      case 'front':
        camera.position.set(0, 0, -distance)
        break
      case 'back':
        camera.position.set(0, 0, distance)
        break
      case 'left':
        camera.position.set(-distance, 0, 0)
        break
      case 'right':
        camera.position.set(distance, 0, 0)
        break
      case 'top':
        camera.position.set(0, -distance, 0)
        break
    }
    camera.lookAt(0, 0, 0)
  }

  const resetCamera = () => {
    if (!viewerRef.current) return
    const camera = viewerRef.current.camera
    if (camera) {
      camera.position.set(0, 0, -5)
      camera.lookAt(0, 0, 0)
    }
  }

  const handleDownload = async () => {
    if (!selectedPly) return
    
    try {
      const response = await fetch(`${API_URL}/ply/${selectedPly}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selectedPly.split('/').pop() || 'model.ply'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError('Erro ao baixar o arquivo')
    }
  }

  const ViewerControls = () => (
    <>
      <div className="camera-control">
        <button 
          className={`toggle-btn camera-toggle ${showCameraButtons ? 'active' : ''}`}
          onClick={() => setShowCameraButtons(!showCameraButtons)}
        >
          <span>Camera</span>
          <span className={`arrow-right ${showCameraButtons ? 'open' : ''}`}>▶</span>
        </button>

        {showCameraButtons && (
          <div className="camera-buttons">
            <button onClick={() => setCameraPosition('front')} className="cam-btn">Front</button>
            <button onClick={() => setCameraPosition('back')} className="cam-btn">Back</button>
            <button onClick={() => setCameraPosition('left')} className="cam-btn">Left</button>
            <button onClick={() => setCameraPosition('right')} className="cam-btn">Right</button>
            <button onClick={() => setCameraPosition('top')} className="cam-btn">Top</button>
            <button onClick={resetCamera} className="cam-btn">Reset</button>
          </div>
        )}
      </div>

      <div className="help-control">
        <button 
          className={`toggle-btn help-toggle ${showNavHelp ? 'active' : ''}`}
          onClick={() => setShowNavHelp(!showNavHelp)}
        >
          <span>Help</span>
          <span className={`arrow-up ${showNavHelp ? 'open' : ''}`}>▲</span>
        </button>

        {showNavHelp && (
          <div className="nav-help-dropdown">
            <div className="nav-section">
              <div className="nav-title">Navigation</div>
              <div className="nav-item">
                <span className="nav-label">Rotate</span>
                <span className="nav-key">Left Click</span>
              </div>
              <div className="nav-item">
                <span className="nav-label">Pan</span>
                <span className="nav-key">Right Click</span>
              </div>
              <div className="nav-item">
                <span className="nav-label">Zoom</span>
                <span className="nav-key">Scroll</span>
              </div>
            </div>
            <div className="nav-divider"></div>
            <div className="nav-section">
              <div className="nav-title">Shortcuts</div>
              <div className="nav-item">
                <span className="nav-label">Set Origin</span>
                <span className="nav-key">C</span>
              </div>
              <div className="nav-item">
                <span className="nav-label">Show Up Axis</span>
                <span className="nav-key">U</span>
              </div>
              <div className="nav-item">
                <span className="nav-label">Info Panel</span>
                <span className="nav-key">I</span>
              </div>
              <div className="nav-item">
                <span className="nav-label">Point Cloud</span>
                <span className="nav-key">P</span>
              </div>
              <div className="nav-item">
                <span className="nav-label">Ortho / Perspective</span>
                <span className="nav-key">O</span>
              </div>
              <div className="nav-item">
                <span className="nav-label">Reset View</span>
                <span className="nav-key">R</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">◆</span>
          <span className="logo-text">SHARP 3D</span>
        </div>
        <p className="subtitle">Transform images into 3D Gaussian Splats</p>
      </header>

      <main className="main-content">
        <div className="left-panel">
          <div className="panel-section">
            <div 
              className="upload-area"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="image-preview" />
              ) : (
                <div className="upload-placeholder">
                  <div className="upload-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                  </div>
                  <p className="upload-text">Drop image here</p>
                  <p className="upload-hint">or click to browse</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />
            </div>

            <button 
              className="generate-button"
              onClick={handleGenerate}
              disabled={!uploadedFilename || isGenerating}
            >
              {isGenerating ? (
                <div className="generating-content">
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <span className="progress-text">
                    {Math.round(generationProgress)}% - {generationStatus}
                  </span>
                </div>
              ) : (
                <>
                  <span className="btn-icon">⚡</span>
                  Generate 3D
                </>
              )}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="right-panel">
          <div className="viewer-wrapper" ref={fullscreenContainerRef}>
            <div 
              className="viewer-container"
              onDrop={handleViewerDrop}
              onDragOver={handleViewerDragOver}
            >
              {sceneLoaded && <ViewerControls />}
              
              <div 
                ref={viewerContainerRef} 
                className="viewer-canvas"
              >
                {!selectedPly && !isLoadingPly && (
                  <div 
                    className="viewer-placeholder"
                    onClick={() => plyInputRef.current?.click()}
                  >
                    <div className="placeholder-content">
                      <div className="placeholder-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                      <p className="placeholder-text">3D Preview</p>
                      <p className="placeholder-hint">Upload an image and click Generate</p>
                      <p className="placeholder-hint-alt">or drop a .ply file here</p>
                    </div>
                    <input
                      ref={plyInputRef}
                      type="file"
                      accept=".ply,.splat"
                      onChange={handlePlyFileSelect}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}
                {isLoadingPly && (
                  <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Loading 3D model...</p>
                  </div>
                )}
              </div>
            </div>

            {isFullscreen && (
              <>
                {sceneLoaded && <ViewerControls />}
                <button className="exit-fullscreen" onClick={exitFullscreen}>
                  ✕
                </button>
              </>
            )}
          </div>

          <div className="bottom-buttons">
            <button 
              className="download-button" 
              onClick={handleDownload} 
              disabled={!sceneLoaded}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Download .ply
            </button>
            
            <button 
              className="fullscreen-button" 
              onClick={handleFullscreen} 
              disabled={!sceneLoaded}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
              </svg>
              Fullscreen
            </button>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <span className="footer-text">Powered by </span>
            <a href="https://github.com/apple/ml-sharp" target="_blank" rel="noopener noreferrer" className="footer-link">
              Apple SHARP
            </a>
            <span className="footer-divider">•</span>
            <span className="footer-text">For research purposes</span>
          </div>
          <div className="footer-right">
            <a href="https://github.com/RodrigoMulinarioRamos/ml-sharp-web-interface" target="_blank" rel="noopener noreferrer" className="footer-github">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <span className="footer-text">Interface by</span>
            <img src="/PXR_Branco.png" alt="PXR" className="footer-logo" />
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
