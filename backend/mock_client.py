import asyncio
import json
import uuid
import websockets

async def main():
    session_id = str(uuid.uuid4())
    url = f"ws://127.0.0.1:8000/ws/live/{session_id}?model=gemini-2.5-flash-native-audio-preview-12-2025"
    print(f"Connecting to {url}")
    
    async with websockets.connect(url) as ws:
        print("Connected!")
        # Send greeting text
        msg = {"type": "text_input", "text": "Hello voice assistant! Are you alive? Respond with exactly one word: 'Yes'."}
        await ws.send(json.dumps(msg))
        print("Sent greeting text")
        
        while True:
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=10.0)
                if isinstance(response, bytes):
                    print(f"Received audio chunk of size {len(response)} bytes")
                else:
                    parsed = json.loads(response)
                    print(f"Received JSON: {parsed}")
            except asyncio.TimeoutError:
                print("10 seconds with no response... Timeout.")
                break

if __name__ == "__main__":
    asyncio.run(main())
