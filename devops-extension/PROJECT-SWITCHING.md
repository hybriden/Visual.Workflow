# Project Switching Feature

## You Asked:
> "Shouldn't project be something I can toggle between?"

## Answer: YES! ✅

Now you can **quickly switch between projects** without going into settings!

## How to Switch Projects

### Method 1: Quick Switch (Fastest) ⚡
**Keyboard Shortcut: `Ctrl+Alt+P`** (Mac: `Cmd+Alt+P`)

```
Press Ctrl+Alt+P
↓
See list of recent projects
↓
Pick one
↓
Instantly switched! Work items reload
```

**What you'll see:**
```
🔍 Current: MyWebApp. Select a project to switch to...

─────────────────────────────────
$(check) MyWebApp                 Current
─────────────────────────────────
MobileApp
─────────────────────────────────
BackendServices
─────────────────────────────────
$(search) Browse all projects...
─────────────────────────────────
```

### Method 2: Browse All Projects
**Command Palette: `Ctrl+Shift+P` → "Azure DevOps: Switch Project"**

```
Opens setup wizard
↓
Fetches ALL your projects
↓
Pick from full list with descriptions
↓
Switched!
```

### Method 3: Status Bar (Click)
**Click the project name in the status bar** (bottom-left)

```
Status bar shows: $(project) MyWebApp
↓
Click it
↓
Quick switch menu opens (same as Ctrl+Alt+P)
```

## Features

### Recent Projects List
- Remembers your last 10 projects
- Shows which one is current ($(check) mark)
- Sorted by most recently used

### Instant Switching
- One command switches projects
- Work items automatically reload
- No need to reconfigure anything

### Smart Status Bar
- Shows current project name
- Click to switch
- Tooltip: "Azure DevOps: ProjectName (Click to switch)"

## Example Workflow

**Scenario:** You work on multiple projects daily

### Old Way (Before):
```
1. Need to check another project
2. Ctrl+, (open settings)
3. Search "Azure DevOps"
4. Find "Project" setting
5. Type new project name (hope you spell it right!)
6. Close settings
7. Wait for reload
```

### New Way (Now):
```
1. Press Ctrl+Alt+P
2. Click project name
3. Done!
```

**Time saved: ~90%** 🎉

## Commands Available

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Quick Switch Project** | `Ctrl+Alt+P` | Switch between recent projects |
| **Switch Project** | (Command Palette) | Browse all available projects |
| **Setup Wizard** | (Command Palette) | Full configuration wizard |

## How It Works

### Recent Projects Tracking
```
You switch to "MyWebApp"
↓
Extension saves it to recent list
↓
Next time you press Ctrl+Alt+P
↓
"MyWebApp" appears in the list
```

### Data Persistence
- Recent projects stored in workspace state
- Persists across VS Code sessions
- Each workspace has its own recent list

## Visual Indicators

### Status Bar
**Before switching:**
```
$(project) MyWebApp
```

**After switching to "MobileApp":**
```
$(project) MobileApp
```

**Not configured:**
```
$(project) Azure DevOps
```

### Quick Pick
```
Current project marked with: $(check)
Browse all option at bottom: $(search)
```

## Keyboard Shortcuts Summary

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Open Sprint Board | `Ctrl+Alt+S` | `Cmd+Alt+S` |
| Open Work Item | `Ctrl+Alt+O` | `Cmd+Alt+O` |
| Change Status | `Ctrl+Alt+U` | `Cmd+Alt+U` |
| **Switch Project** | **`Ctrl+Alt+P`** | **`Cmd+Alt+P`** |

## Settings

The "project" setting is still there, but now:

**Before:**
- Manual entry only
- Had to type exact name
- Could have typos

**Now:**
- Auto-filled by wizard
- Auto-filled by quick switch
- Or manually edit if you prefer

```
Ctrl+, → Search "Azure DevOps"

Azure DevOps: Project
└─ [current project name]
   (Updated automatically when you switch)
```

## Use Cases

### Use Case 1: Multi-Project Developer
```
Morning: Work on "Frontend"
  → Press Ctrl+Alt+P → Select "Frontend"

Afternoon: Bug fix in "Backend"
  → Press Ctrl+Alt+P → Select "Backend"

End of day: Update docs in "Documentation"
  → Press Ctrl+Alt+P → Select "Documentation"
```

### Use Case 2: Consultant
```
Client A sprint: "ClientA-WebApp"
  → Quick switch to it

Client B review: "ClientB-Mobile"
  → Quick switch to it

No context switching delays!
```

### Use Case 3: Team Lead
```
Check Team 1's sprint: "Team1-Project"
  → Quick switch

Check Team 2's sprint: "Team2-Project"
  → Quick switch

Review all teams efficiently!
```

## Tips

### Tip 1: Use Quick Switch for Regulars
If you switch between the same 3-5 projects regularly:
- Use `Ctrl+Alt+P` (Quick Switch)
- Your projects will be in the recent list
- One click to switch

### Tip 2: Use Browse All for Exploration
If exploring or need a project you haven't used recently:
- Use Command Palette → "Switch Project"
- See ALL available projects
- Adds to your recent list

### Tip 3: Click Status Bar
The fastest visual method:
- Look at status bar (bottom-left)
- See current project
- Click to switch

### Tip 4: Keyboard is Fastest
Memorize `Ctrl+Alt+P`:
- Works from anywhere
- No mouse needed
- Muscle memory friendly

## What You Get

✅ **Quick switching** - `Ctrl+Alt+P`
✅ **Recent projects list** - Your last 10
✅ **Status bar indicator** - See current project
✅ **Clickable status bar** - Switch with one click
✅ **Auto-reload** - Work items refresh automatically
✅ **No reconfiguration** - Org and PAT stay the same

## Architecture

```
Project Switching Flow:
────────────────────────

User presses Ctrl+Alt+P
↓
Check workspace state for recent projects
↓
Show quick pick with recent + "Browse all..."
↓
User selects project
↓
Update azureDevOps.project setting
↓
Fire configuration change event
↓
Extension reloads work items
↓
Track project in recent list
↓
Update status bar
↓
Done!
```

## Files Involved

- `src/commands/projectSwitcher.ts` - Switching logic
- `package.json` - Commands and shortcuts
- `src/extension.ts` - Status bar updates
- Workspace state - Recent projects storage

## Comparison

| Feature | Before | Now |
|---------|--------|-----|
| **Switch method** | Settings | Quick pick |
| **Speed** | Slow (~30 sec) | Fast (~2 sec) |
| **Typing required** | Yes | No |
| **Recent projects** | No | Yes |
| **Status indicator** | No | Yes |
| **Keyboard shortcut** | No | Yes (`Ctrl+Alt+P`) |
| **Mouse clicks** | 5-7 | 1-2 |

## Summary

**Your intuition was correct!** Project switching is now:

🎯 **Fast** - One keyboard shortcut
🎯 **Visual** - Status bar shows current project
🎯 **Smart** - Remembers recent projects
🎯 **Flexible** - Multiple ways to switch

**Press `Ctrl+Alt+P` and see for yourself!** 🚀

---

## Quick Test

1. Press `F5` (if not already running)
2. Configure if needed
3. Press `Ctrl+Alt+P`
4. See your projects!
5. Switch to another
6. Watch work items reload
7. Look at status bar - see new project name!

**Project switching is now as easy as it should be!** ✨
