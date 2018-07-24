#include <node.h>
#include <nan.h>
#include <v8.h>
#include <stdio.h>
#include "sourceId2Coordinates.h"

using namespace v8;

NAN_METHOD(sourceId2Coordinates)
{
	const int sourceID = info[0]->Int32Value();
	Local<Object> obj = Nan::New<Object>();
	Point coordinates;
	int displayWidth;
	int displayHeight;
	if(!sourceId2Coordinates(sourceID, &coordinates, displayWidth, displayHeight))
	{ // return undefined if sourceId2Coordinates function fail.
		info.GetReturnValue().Set(Nan::Undefined());
	}
	else
	{ // return the coordinates if sourceId2Coordinates function succeed.
		Nan::Set(obj, Nan::New("x").ToLocalChecked(), Nan::New(coordinates.x));
		Nan::Set(obj, Nan::New("y").ToLocalChecked(), Nan::New(coordinates.y));

		Nan::Set(obj, Nan::New("width").ToLocalChecked(), Nan::New(displayWidth));
		Nan::Set(obj, Nan::New("height").ToLocalChecked(), Nan::New(displayHeight));
		
		Nan::Set(obj, Nan::New("vscreenWidth").ToLocalChecked(), Nan::New(vscreen_width));
		Nan::Set(obj, Nan::New("vscreenHeight").ToLocalChecked(), Nan::New(vscreen_height));
		Nan::Set(obj, Nan::New("vscreenMinX").ToLocalChecked(), Nan::New(vscreen_min_x));
		Nan::Set(obj, Nan::New("vscreenMinY").ToLocalChecked(), Nan::New(vscreen_min_y));

		info.GetReturnValue().Set(obj);
	}
}

NAN_METHOD(moveMouse)
{
	const int x = info[0]->Int32Value();
	const int y = info[1]->Int32Value();
	int result = moveMouse(x,y);
	Local<Number> n = Nan::New<Number>(result);

	info.GetReturnValue().Set(n);
}

NAN_MODULE_INIT(Init)
{
	Nan::Set(
		target,
		Nan::New("sourceId2Coordinates").ToLocalChecked(),
		Nan::GetFunction(Nan::New<FunctionTemplate>(sourceId2Coordinates))
			.ToLocalChecked()
	);

	Nan::Set(
		target,
		Nan::New("moveMouse").ToLocalChecked(),
		Nan::GetFunction(Nan::New<FunctionTemplate>(moveMouse))
			.ToLocalChecked()
	);
}

NODE_MODULE(sourceId2CoordinatesModule, Init)
