<script lang="ts">
	let isRecording = $state(false);
	let isLoading = $state(false);
	let transcript = $state('');
	let decade = $state<number | null>(null);
	let imageBase64 = $state('');
	let mediaType = $state('');
	let errorMessage = $state('');

	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];

	async function startRecording() {
		errorMessage = '';
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaRecorder = new MediaRecorder(stream);
			audioChunks = [];

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunks.push(e.data);
			};

			mediaRecorder.onstop = async () => {
				stream.getTracks().forEach((t) => t.stop());
				const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
				await processAudio(audioBlob);
			};

			mediaRecorder.start();
			isRecording = true;
		} catch (err) {
			errorMessage = 'Microphone access denied';
		}
	}

	function stopRecording() {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
			isRecording = false;
		}
	}

	async function processAudio(audioBlob: Blob) {
		isLoading = true;
		transcript = '';
		decade = null;
		imageBase64 = '';
		errorMessage = '';

		const formData = new FormData();
		formData.append('audio', audioBlob, 'recording.webm');

		// #region agent log
		fetch('http://127.0.0.1:7245/ingest/d7115a44-5141-4c52-809e-dc7db53678d4', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: '+page.svelte:processAudio:entry',
				message: 'Starting processAudio',
				data: { audioBlobSize: audioBlob.size, audioBlobType: audioBlob.type },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				hypothesisId: 'B,D'
			})
		}).catch(() => {});
		// #endregion

		try {
			const res = await fetch('/api/memory-image', {
				method: 'POST',
				body: formData
			});

			// #region agent log
			fetch('http://127.0.0.1:7245/ingest/d7115a44-5141-4c52-809e-dc7db53678d4', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: '+page.svelte:processAudio:response',
					message: 'Received API response',
					data: { status: res.status, statusText: res.statusText, ok: res.ok, url: res.url },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					hypothesisId: 'B,E'
				})
			}).catch(() => {});
			// #endregion

			if (!res.ok) {
				const text = await res.text();
				// #region agent log
				fetch('http://127.0.0.1:7245/ingest/d7115a44-5141-4c52-809e-dc7db53678d4', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: '+page.svelte:processAudio:errorBody',
						message: 'Response not ok - raw body',
						data: { status: res.status, rawBody: text.substring(0, 500) },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						hypothesisId: 'E'
					})
				}).catch(() => {});
				// #endregion
				let data;
				try {
					data = JSON.parse(text);
				} catch {
					data = { message: text };
				}
				throw new Error(data.message || 'Request failed');
			}

			const data = await res.json();
			transcript = data.transcript;
			decade = data.decade;
			imageBase64 = data.imageBase64;
			mediaType = data.mediaType;
		} catch (err) {
			// #region agent log
			fetch('http://127.0.0.1:7245/ingest/d7115a44-5141-4c52-809e-dc7db53678d4', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: '+page.svelte:processAudio:catch',
					message: 'Caught error',
					data: { errorMsg: err instanceof Error ? err.message : String(err) },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					hypothesisId: 'E'
				})
			}).catch(() => {});
			// #endregion
			errorMessage = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			isLoading = false;
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
			disabled={isLoading}
			class="rounded-full px-8 py-4 text-lg font-semibold text-[var(--color-beige)] transition-all
                   {isRecording
				? 'animate-pulse bg-red-600 hover:bg-red-700'
				: 'bg-[var(--color-coffee)] hover:bg-[var(--color-coffee-light)]'}
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
			<p class="mt-4 text-red-600">{errorMessage}</p>
		{/if}
	</section>

	<!-- Right Column -->
	<section class="flex flex-1 items-center justify-center bg-white/30 p-8">
		{#if isLoading}
			<div class="flex flex-col items-center gap-4">
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-coffee)] border-t-transparent"
				></div>
				<p class="opacity-70">Generating your memory...</p>
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
