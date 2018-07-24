struct Point {
    int x;
    int y;
    Point(): x(0), y(0) {};
};

extern int vscreen_width; //The width of the virtual screen, in pixels. 
extern int vscreen_height; //The height of the virtual screen, in pixels. 
extern int vscreen_min_x; //x coordinate for the left side of the virtual screen
extern int vscreen_min_y; //y coordinate for the top of the virtual screen

bool sourceId2Coordinates(int sourceId, Point* res, int& width, int& height);

unsigned int moveMouse(int x, int y);