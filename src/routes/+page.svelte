<script lang="ts">
	import { onMount } from 'svelte';

	type FlowState = 'idle' | 'recording' | 'transcribing' | 'generating' | 'ready' | 'error';

	let flowState = $state<FlowState>('idle');
	let transcript = $state('');
	let decade = $state<number | null>(null);
	let imageBase64 = $state('');
	let mediaType = $state('');
	let errorMessage = $state('');
	let userErrorMessage = $state('');
	let galleryImages = $state<string[]>([]);
	let modalImage = $state<string | null>(null);

	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let activeRun = $state(0);
	let runStart = $state(0);

	const isRecording = $derived(flowState === 'recording');
	const isBusy = $derived(flowState === 'transcribing' || flowState === 'generating');

	function logEvent(event: string, details?: Record<string, unknown>) {
		const sinceStart = runStart ? `${Date.now() - runStart}ms` : 'n/a';
		const payload = {
			runId: activeRun,
			state: flowState,
			sinceStart,
			...details
		};
		console.info(`[memory-flow] ${event}`, payload);
	}

	function resetOutputs() {
		transcript = '';
		decade = null;
		imageBase64 = '';
		mediaType = '';
		userErrorMessage = '';
	}

	async function loadGallery() {
		const res = await fetch('/api/gallery');
		if (res.ok) galleryImages = await res.json();
	}

	onMount(() => {
		loadGallery();
	});

	async function startRecording() {
		if (isBusy || isRecording) return;
		errorMessage = '';
		userErrorMessage = '';
		resetOutputs();
		flowState = 'recording';
		const runId = activeRun + 1;
		activeRun = runId;
		runStart = Date.now();
		logEvent('recording:start');
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaRecorder = new MediaRecorder(stream);
			audioChunks = [];

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunks.push(e.data);
			};

			mediaRecorder.onstop = async () => {
				stream.getTracks().forEach((t) => t.stop());
				mediaRecorder = null;
				const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
				logEvent('recording:stop', { size: audioBlob.size, type: audioBlob.type });
				await processAudio(audioBlob, runId);
			};

			mediaRecorder.start();
		} catch (err) {
			errorMessage = 'Microphone access denied';
			userErrorMessage =
				'Mikrofonzugriff blockiert. Bitte erlaube den Zugriff und versuche es erneut.';
			flowState = 'error';
			logEvent('recording:error', {
				error: err instanceof Error ? err.message : 'Microphone access denied'
			});
		}
	}

	function stopRecording() {
		if (mediaRecorder && isRecording) {
			flowState = 'transcribing';
			mediaRecorder.stop();
			logEvent('recording:stop_requested');
		}
	}

	async function processAudio(audioBlob: Blob, runId: number) {
		if (runId !== activeRun) return;
		errorMessage = '';
		userErrorMessage = '';
		flowState = 'transcribing';
		logEvent('transcribe:start');

		const phaseTimer = setTimeout(() => {
			if (runId === activeRun && flowState === 'transcribing') {
				flowState = 'generating';
				logEvent('generate:estimated');
			}
		}, 1200);

		const formData = new FormData();
		formData.append('audio', audioBlob, 'recording.webm');

		try {
			const startedAt = Date.now();
			const res = await fetch('/api/memory-image', {
				method: 'POST',
				body: formData
			});
			logEvent('api:response', { status: res.status, durationMs: Date.now() - startedAt });

			if (!res.ok) {
				const text = await res.text();
				let data;
				try {
					data = JSON.parse(text);
				} catch {
					data = { message: text };
				}
				throw new Error(data.message || 'Request failed');
			}

			const data = await res.json();
			if (runId !== activeRun) return;
			transcript = data.transcript;
			decade = data.decade;
			imageBase64 = data.imageBase64;
			mediaType = data.mediaType;
			await loadGallery();
			flowState = 'ready';
			logEvent('generate:success', { decade, mediaType, bytes: imageBase64.length });
		} catch (err) {
			if (runId !== activeRun) return;
			errorMessage = err instanceof Error ? err.message : 'Something went wrong';
			if (errorMessage.toLowerCase().includes('detect decade')) {
				userErrorMessage =
					'Ich konnte das Jahrzehnt nicht erkennen. Nenne bitte eine Jahreszahl oder ein Jahrzehnt (z. B. 1980er).';
			} else if (errorMessage.toLowerCase().includes('microphone')) {
				userErrorMessage =
					'Mikrofonzugriff blockiert. Bitte erlaube den Zugriff und versuche es erneut.';
			} else {
				userErrorMessage =
					'Das hat gerade nicht geklappt. Bitte versuche es in einem Moment noch einmal.';
			}
			flowState = 'error';
			logEvent('generate:error', { error: errorMessage });
		} finally {
			clearTimeout(phaseTimer);
		}
	}
</script>

<title>Flüsterungen</title>

<main class="flex min-h-screen flex-col md:flex-row">
	<!-- Left Column -->
	<section class="flex flex-1 flex-col items-center justify-center p-8">
		<h1 class="mb-4 text-4xl font-bold">Flüsterungen</h1>
		<p class="mb-8 text-center text-lg opacity-80">
			Share a memory from your past. Tell us the decade, and we'll bring it to life.
		</p>

		<button
			onclick={isRecording ? stopRecording : startRecording}
			disabled={isBusy}
			class="rounded-full px-8 py-4 text-lg font-semibold text-[--color-beige] transition-all
                   {isRecording
				? 'animate-pulse bg-red-600 hover:bg-red-700'
				: 'bg-[--color-coffee] hover:bg-[--color-coffee-light]'}
                   disabled:cursor-not-allowed disabled:opacity-50"
		>
			{isRecording ? 'Stop Recording' : 'Start Recording'}
		</button>

		{#if transcript}
			<div class="mt-8 max-w-md rounded-lg bg-white/50 p-4">
				<p class="text-sm font-medium opacity-70">Your memory:</p>
				<p class="mt-1 italic">"{transcript}"</p>
				{#if decade}
					<p class="mt-2 text-sm font-semibold">Detected decade: {decade}s</p>
				{/if}
			</div>
		{/if}

		{#if errorMessage}
			<p class="mt-4 rounded-md bg-white/60 px-3 py-2 text-sm text-[--color-coffee]">
				{userErrorMessage || errorMessage}
			</p>
		{/if}
	</section>

	<!-- Right Column -->
	<section class="flex flex-1 items-center justify-center bg-white/30 p-8">
		{#if isBusy}
			<div class="flex flex-col items-center gap-4">
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-[--color-coffee] border-t-transparent"
				></div>
				<p class="opacity-70">
					{flowState === 'transcribing'
						? 'Transcribing your memory...'
						: 'Generating your memory...'}
				</p>
			</div>
		{:else if imageBase64}
			<img
				src="data:{mediaType};base64,{imageBase64}"
				alt="Generated memory"
				class="max-h-[80vh] max-w-full rounded-lg shadow-lg"
			/>
		{:else}
			<div class="text-center opacity-50">
				<p class="text-xl">Your image will appear here</p>
				<p class="mt-2 text-sm">Record a memory to get started</p>
			</div>
		{/if}
	</section>
</main>

<!-- Gallery Section -->
{#if galleryImages.length > 0}
	<section class="bg-white/20 px-8 py-16">
		<h2 class="mb-8 text-center text-3xl font-bold">Your Memories</h2>
		<div class="mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
			{#each galleryImages as src (src)}
				<button type="button" onclick={() => (modalImage = src)} class="cursor-pointer">
					<img
						{src}
						alt="Memory"
						class="aspect-square w-full rounded-lg object-cover shadow-md transition-transform hover:scale-105"
					/>
				</button>
			{/each}
		</div>
	</section>
{/if}

<!-- Polaroid Modal -->
{#if modalImage}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
		onclick={() => (modalImage = null)}
		onkeydown={(e) => e.key === 'Escape' && (modalImage = null)}
		role="button"
		tabindex="0"
	>
		<div
			class="rotate-2 transform bg-white p-4 pb-16 shadow-2xl transition-transform"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<img src={modalImage} alt="Memory" class="max-h-[70vh] max-w-[80vw] object-contain" />
		</div>
		<button
			type="button"
			class="absolute top-6 right-6 text-4xl text-white hover:text-gray-300"
			onclick={() => (modalImage = null)}
		>
			&times;
		</button>
	</div>
{/if}
