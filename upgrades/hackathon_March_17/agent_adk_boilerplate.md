# POView: Network Analysis Agent Boilerplate (Google Agent ADK)

Based on your project's goal to generate a complete narrative analysis of a given neighborhood query, here is a boilerplate architecture implementation using the **Google Agent ADK**. 

We adopt the `SequentialAgent` pattern described in the official documentation, utilizing three distinct sub-agents to construct the narrative, orchestrate the visuals (drone zoom), and format the response.

## ADK Core Agent Categories Overview

The Google Agent ADK provides three primary categories of agents that work together in a **Multi-Agent System**:
1. **LLM Agents (`LlmAgent`)**: The intelligent core. They use LLMs for natural language reasoning, generation, and tool use. They are non-deterministic and dynamic.
2. **Workflow Agents (`SequentialAgent`, `ParallelAgent`, `LoopAgent`)**: The orchestrators. They control the execution flow of sub-agents deterministically and predictably, without relying on an LLM for routing.
3. **Custom Agents (`BaseAgent` subclass)**: Used when you need heavily specialized operational logic tailored to unique integrations.
   * **Note on POView Upgrade**: We want to use this for the upgrade to essentially give the agent the control of the camera flying over the globe for it to move around spatially to analyze the place of reference given by the user on the map.

ADK also allows capability extensions via **AI Models**, **Artifacts**, **Tools**, **Plugins**, and **Skills**.

In our POView implementation, we combine **LLM Agents** (for research, visualization planning, and formatting) orchestrated by a **Workflow Agent** (Sequential execution).

### Boilerplate Implementation (Python)

```python
"""
POView - Neighborhood Narrative Sequential Agent Setup using Google Agent ADK

This boilerplate demonstrates how to configure a SequentialAgent to orchestrate 
multiple LlmAgents to gather information, analyze it, visualize the spatial layout,
and produce a formatted neighborhood narrative for POView.
"""

from google_genai import types
from google_genai.agents import LlmAgent, SequentialAgent, InvocationContext

# ------------------------------------------------------------------------------
# 1. Define Tools
# ------------------------------------------------------------------------------
# These tools allow the first agent to access external resources as planned.
search_tool = types.Tool(google_search=types.GoogleSearch())
maps_tool = types.Tool(google_maps=types.GoogleMaps())

def zillow_api_lookup(query: str) -> str:
    """Custom resource tool placeholder for real estate data."""
    return f"Mock Zillow data for {query}"

from google_genai.agents import BaseAgent

# ------------------------------------------------------------------------------
# 2. Define Sub-Agents (LlmAgents & Custom Agents)
# ------------------------------------------------------------------------------

# Agent 1: ScriptWriter Agent
# Role: Gathers facts using search/map tools and drafts the raw analysis narrative.
script_writer_agent = LlmAgent(
    name="ScriptWriterAgent",
    model="gemini-2.5-pro", # Using Pro for deep reasoning and map grounding
    instructions=\"\"\"
    You are an expert real estate and neighborhood researcher. 
    Use the provided Google Search and Google Maps tools to gather factual data 
    (demographics, points of interest, recent news) about the user's query.
    Write a detailed, informative narrative script.
    \"\"\",
    tools=[search_tool, maps_tool, zillow_api_lookup],
    # The output of this agent is stored in the shared context under the key 'raw_narrative'
    output_key="raw_narrative", 
)

# Agent 2: Globe Controller Agent (Custom Agent)
# Role: Determines visual rendering instructions and controls the camera flying over the globe.
class GlobeControllerAgent(BaseAgent):
    def __init__(self, name: str):
        super().__init__(name=name)
        # We can instantiate an internal LLM agent to parse coordinates
        self.coordinate_parser = LlmAgent(
            name="CoordinateParser",
            model="gemini-2.5-flash",
            instructions=\"\"\"
            Given a raw neighborhood narrative, extract 3 distinct points of interest.
            Provide latitude, longitude, and a brief description for the drone view.
            Format as a JSON array.
            \"\"\"
            # Output will be handled explicitly inside the custom agent's run loop
        )

    async def run_async_impl(self, input_data: str, context: InvocationContext):
        # 1. Retrieve the narrative from the previous agent
        raw_narrative = context.get("raw_narrative")
        
        # 2. Use our internal LLM to parse coordinates out of the narrative
        coords_response = await self.coordinate_parser.run_async(input=raw_narrative, context=context)
        
        # 3. Custom Operational Logic: "Fly the Camera"
        # Here we would integrate with our Globe/Cesium API or emit an event
        camera_instructions = f"Executing Drone Flight Plan for: {coords_response.text}"
        print(f"[GlobeControllerAgent] Flying camera to analyze the place of reference...")
        
        # 4. Save our visualization plan for the next agent
        context.set("visualization_plan", camera_instructions)
        
        return camera_instructions

# Instantiate the custom agent
visualizer_agent = GlobeControllerAgent(name="VisualizerAgent")

# Agent 3: Formatter Agent
# Role: Combines all context into the final required schema/format.
formatter_agent = LlmAgent(
    name="FormatterAgent",
    model="gemini-2.5-flash",
    instructions=\"\"\"
    You are a meticulous formatter. You will receive a 'raw_narrative' and a 'visualization_plan'.
    Combine them into a single cohesive JSON payload ready for the POView UI to render.
    Ensure the narrative is separated from the camera/drone instructions.
    \"\"\",
    input_keys=["raw_narrative", "visualization_plan"],
    # Final output of the sequence
    output_key="final_ui_payload"
)

# ------------------------------------------------------------------------------
# 3. Define the Workflow (Sequential Agent)
# ------------------------------------------------------------------------------

# The SequentialAgent guarantees strict ordering: Write -> Visualize -> Format
poview_narrative_workflow_agent = SequentialAgent(
    name="NeighborhoodNarrativeAgent",
    sub_agents=[
        script_writer_agent,
        visualizer_agent,
        formatter_agent
    ]
)

# ------------------------------------------------------------------------------
# 4. Example Execution
# ------------------------------------------------------------------------------
async def generate_neighborhood_analysis(user_query: str):
    \"\"\"
    Executes the sequential workflow.
    The SequentialAgent passes a shared 'InvocationContext' to each of its sub-agents,
    making it easy to pass data (via input_keys/output_keys) between steps within a single turn.
    \"\"\"
    context = InvocationContext()
    
    # Run the workflow
    response = await poview_narrative_workflow_agent.run_async(
        input=user_query,
        context=context
    )
    
    # Retrieve the final artifact from the shared state
    final_payload = context.get("final_ui_payload")
    return final_payload

```

### How this pattern fits your goals:
1. **Scripting Agent for existing analysis:** `ScriptWriterAgent` handles the heavy lifting of grounding the query through Gemini tools (Google Search, Maps, Zillow).
2. **Drone Zoom View:** The `VisualizerAgent` is strictly dedicated to parsing that narrative and converting it into coordinate actions for the Globe control mechanism.
3. **Sequential Determinism:** By using the `SequentialAgent`, you guarantee that you will never try to compute map points for a narrative that hasn't been fully formulated, bypassing LLM hallucinations where an LLM tries to do too many tasks in a single prompt.
