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
        # Do not send text greeting, just stream audio.
        import math
        import struct
        print("Streaming 3 seconds of a 440Hz sine wave...")
        sample_rate = 16000
        duration = 3.0
        buf = bytearray()
        for i in range(int(sample_rate * duration)):
            sample = int(32767 * math.sin(2 * math.pi * 440 * i / sample_rate))
            buf.extend(struct.pack('<h', sample))
        
        # Send in 4096 byte chunks
        for i in range(0, len(buf), 4096):
            chunk = buf[i:i+4096]
            await ws.send(chunk)
            await asyncio.sleep(0.128) # Simulate realtime
            
        print("Finished sending audio. Waiting for response...")
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
