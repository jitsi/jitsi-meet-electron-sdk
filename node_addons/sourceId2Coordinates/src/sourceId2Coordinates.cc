#if defined(IS_WINDOWS)
#include <windows.h>
#endif

#include "sourceId2Coordinates.h"

#if defined(IS_WINDOWS)
//Mouse motion is now done using SendInput with MOUSEINPUT. We use Absolute mouse positioning
#define MOUSE_COORD_TO_ABS(coord, width_or_height) (65536 * (coord) / width_or_height)

int vscreen_width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
int vscreen_height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
int vscreen_min_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
int vscreen_min_y = GetSystemMetrics(SM_YVIRTUALSCREEN);

//DPI_AWARENESS_CONTEXT d = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE);
#endif

/**
 * Tries to get the coordinates of a desktop from passed sourceId
 * (which identifies a desktop sharing source). Used to match the source id to a
 * screen in Electron.
 *
 * Returns true on success and false on failure.
 *
 * NOTE: Works on windows only because on the other platforms there is an easier
 * way to match the source id and the screen.
 */
bool sourceId2Coordinates(int sourceId, Point* res, int& width, int& height)
{
#if defined(IS_WINDOWS)
    //Update virtual screen information before mouse moving
    vscreen_width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    vscreen_height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
    vscreen_min_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
    vscreen_min_y = GetSystemMetrics(SM_YVIRTUALSCREEN);

    DISPLAY_DEVICE device;
    device.cb = sizeof(device);

    if (!EnumDisplayDevices(NULL, sourceId, &device, 0) // device not found
        || !(device.StateFlags & DISPLAY_DEVICE_ACTIVE))// device is not active
    {
        return false;
    }

    DEVMODE deviceSettings;
    deviceSettings.dmSize = sizeof(deviceSettings);
    deviceSettings.dmDriverExtra = 0;
    if(!EnumDisplaySettingsEx(device.DeviceName, ENUM_CURRENT_SETTINGS, &deviceSettings, 0))
    {
        return false;
    }

    res->x = deviceSettings.dmPosition.x;
    res->y = deviceSettings.dmPosition.y;

    width = deviceSettings.dmPelsWidth;
    height = deviceSettings.dmPelsHeight;

    return true;
#else
    return false;
#endif
}

/**
 * Moves mouse on the virtual screen
 */
unsigned int moveMouse(int x, int y)
{
#if defined(IS_WINDOWS)
	x = MOUSE_COORD_TO_ABS(x-vscreen_min_x, vscreen_width);
	y = MOUSE_COORD_TO_ABS(y-vscreen_min_y, vscreen_height);
	INPUT mouseInput;
	mouseInput.type = INPUT_MOUSE;
	mouseInput.mi.dx = x;
	mouseInput.mi.dy = y;
	mouseInput.mi.dwFlags = MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE | MOUSEEVENTF_VIRTUALDESK;
	mouseInput.mi.time = 0; //System will provide the timestamp
	mouseInput.mi.dwExtraInfo = 0;
	mouseInput.mi.mouseData = 0;
	return SendInput(1, &mouseInput, sizeof(mouseInput));
#endif
    return 0;
}