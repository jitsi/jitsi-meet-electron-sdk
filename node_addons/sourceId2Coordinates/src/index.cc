#include <napi.h>
#include "sourceId2Coordinates.h"

Napi::Value sourceId2CoordinatesWrapper(const Napi::CallbackInfo& info)
{
	Napi::Env env = info.Env();
	const int sourceID =  info[0].As<Napi::Number>().Int32Value();
	Napi::Object obj = Napi::Object::New(env);
	Point coordinates;
	if(!sourceId2Coordinates(sourceID, &coordinates))
	{ // return undefined if sourceId2Coordinates function fail.
		return env.Undefined();
	}
	else
	{ // return the coordinates if sourceId2Coordinates function succeed.
		obj.Set(Napi::String::New(env, "x"), Napi::Number::New(env, coordinates.x));
		obj.Set(Napi::String::New(env, "y"), Napi::Number::New(env, coordinates.y));
		return obj;
	}
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set(Napi::String::New(env, "sourceId2Coordinates"), Napi::Function::New(env, sourceId2CoordinatesWrapper));

	return exports;
}

NODE_API_MODULE(sourceId2CoordinatesModule, Init)
