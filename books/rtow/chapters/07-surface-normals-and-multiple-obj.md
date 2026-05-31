# Surface Normals and Multiple Objects
## Shading with Surface Normals
First, let’s get ourselves a surface normal so we can shade. This is a vector that is perpendicular
to the surface at the point of intersection.

We have a key design decision to make for normal vectors in our code: whether normal vectors will
have an arbitrary length, or will be normalized to unit length.

It is tempting to skip the expensive square root operation involved in normalizing the vector, in
case it's not needed. In practice, however, there are three important observations. First, if a
unit-length normal vector is _ever_ required, then you might as well do it up front once, instead of
over and over again "just in case" for every location where unit-length is required. Second, we _do_
require unit-length normal vectors in several places. Third, if you require normal vectors to be
unit length, then you can often efficiently generate that vector with an understanding of the
specific geometry class, in its constructor, or in the `hit()` function. For example, sphere normals
can be made unit length simply by dividing by the sphere radius, avoiding the square root entirely.

Given all of this, we will adopt the policy that all normal vectors will be of unit length.

For a sphere, the outward normal is in the direction of the hit point minus the center:

  ![Figure [sphere-normal]: Sphere surface-normal geometry](../images/fig-1.06-sphere-normal.jpg)

On the earth, this means that the vector from the earth’s center to you points straight up. Let’s
throw that into the code now, and shade it. We don’t have any lights or anything yet, so let’s just
visualize the normals with a color map. A common trick used for visualizing normals (because it’s
easy and somewhat intuitive to assume \(\mathbf{n}\) is a unit length vector -- so each component is
between -1 and 1) is to map each component to the interval from 0 to 1, and then map \((x, y, z)\) to
\((\mathit{red}, \mathit{green}, \mathit{blue})\). For the normal, we need the hit point, not just
whether we hit or not (which is all we're calculating at the moment). We only have one sphere in the
scene, and it's directly in front of the camera, so we won't worry about negative values of \(t\) yet.
We'll just assume the closest hit point (smallest \(t\)) is the one that we want. These changes in the
code let us compute and visualize \(\mathbf{n}\):

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    double hit_sphere(const point3& center, double radius, const ray& r) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
        vec3 oc = center - r.origin();
        auto a = dot(r.direction(), r.direction());
        auto b = -2.0 * dot(r.direction(), oc);
        auto c = dot(oc, oc) - radius*radius;
        auto discriminant = b*b - 4*a*c;


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        if (discriminant < 0) {
            return -1.0;
        } else {
            return (-b - std::sqrt(discriminant) ) / (2.0*a);
        }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    }

    color ray_color(const ray& r) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        auto t = hit_sphere(point3(0,0,-1), 0.5, r);
        if (t > 0.0) {
            vec3 N = unit_vector(r.at(t) - vec3(0,0,-1));
            return 0.5*color(N.x()+1, N.y()+1, N.z()+1);
        }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        vec3 unit_direction = unit_vector(r.direction());
        auto a = 0.5*(unit_direction.y() + 1.0);
        return (1.0-a)*color(1.0, 1.0, 1.0) + a*color(0.5, 0.7, 1.0);
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [render-surface-normal]: <kbd>[main.cc]</kbd> Rendering surface normals on a sphere]

<div class='together'>
And that yields this picture:

  ![Image 4: A sphere colored according to its normal vectors](data:image/png;base64,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)

</div>


## Simplifying the Ray-Sphere Intersection Code
Let’s revisit the ray-sphere function:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    double hit_sphere(const point3& center, double radius, const ray& r) {
        vec3 oc = center - r.origin();
        auto a = dot(r.direction(), r.direction());
        auto b = -2.0 * dot(r.direction(), oc);
        auto c = dot(oc, oc) - radius*radius;
        auto discriminant = b*b - 4*a*c;

        if (discriminant < 0) {
            return -1.0;
        } else {
            return (-b - std::sqrt(discriminant) ) / (2.0*a);
        }
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [ray-sphere-before]: <kbd>[main.cc]</kbd> Ray-sphere intersection code (before)]

First, recall that a vector dotted with itself is equal to the squared length of that vector.

Second, notice how the equation for `b` has a factor of negative two in it. Consider what happens to
the quadratic equation if \(b = -2h\):

  \[ \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} \]

  \[ = \frac{-(-2h) \pm \sqrt{(-2h)^2 - 4ac}}{2a} \]

  \[ = \frac{2h \pm 2\sqrt{h^2 - ac}}{2a} \]

  \[ = \frac{h \pm \sqrt{h^2 - ac}}{a} \]

This simplifies nicely, so we'll use it. So solving for \(h\):

  \[ b = -2 \mathbf{d} \cdot (\mathbf{C} - \mathbf{Q}) \]
  \[ b = -2h \]
  \[ h = \frac{b}{-2} = \mathbf{d} \cdot (\mathbf{C} - \mathbf{Q}) \]

<div class='together'>
Using these observations, we can now simplify the sphere-intersection code to this:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    double hit_sphere(const point3& center, double radius, const ray& r) {
        vec3 oc = center - r.origin();
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        auto a = r.direction().length_squared();
        auto h = dot(r.direction(), oc);
        auto c = oc.length_squared() - radius*radius;
        auto discriminant = h*h - a*c;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        if (discriminant < 0) {
            return -1.0;
        } else {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
            return (h - std::sqrt(discriminant)) / a;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
        }
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [ray-sphere-after]: <kbd>[main.cc]</kbd> Ray-sphere intersection code (after)]

</div>


## An Abstraction for Hittable Objects
Now, how about more than one sphere? While it is tempting to have an array of spheres, a very clean
solution is to make an “abstract class” for anything a ray might hit, and make both a sphere and a
list of spheres just something that can be hit. What that class should be called is something of a
quandary -- calling it an “object” would be good if not for “object oriented” programming. “Surface”
is often used, with the weakness being maybe we will want volumes (fog, clouds, stuff like that).
“hittable” emphasizes the member function that unites them. I don’t love any of these, but we'll go
with “hittable”.

This `hittable` abstract class will have a `hit` function that takes in a ray. Most ray tracers have
found it convenient to add a valid interval for hits \(t_{\mathit{min}}\) to \(t_{\mathit{max}}\), so
the hit only “counts” if \(t_{\mathit{min}} < t < t_{\mathit{max}}\). For the initial rays this is
positive \(t\), but as we will see, it can simplify our code to have an interval \(t_{\mathit{min}}\) to
\(t_{\mathit{max}}\). One design question is whether to do things like compute the normal if we hit
something. We might end up hitting something closer as we do our search, and we will only need the
normal of the closest thing. I will go with the simple solution and compute a bundle of stuff I will
store in some structure. Here’s the abstract class:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #ifndef HITTABLE_H
    #define HITTABLE_H

    #include "ray.h"

    class hit_record {
      public:
        point3 p;
        vec3 normal;
        double t;
    };

    class hittable {
      public:
        virtual ~hittable() = default;

        virtual bool hit(const ray& r, double ray_tmin, double ray_tmax, hit_record& rec) const = 0;
    };

    #endif
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [hittable-initial]: <kbd>[hittable.h]</kbd> The hittable class]

<div class='together'>
And here’s the sphere:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #ifndef SPHERE_H
    #define SPHERE_H

    #include "hittable.h"
    #include "vec3.h"

    class sphere : public hittable {
      public:
        sphere(const point3& center, double radius) : center(center), radius(std::fmax(0,radius)) {}

        bool hit(const ray& r, double ray_tmin, double ray_tmax, hit_record& rec) const override {
            vec3 oc = center - r.origin();
            auto a = r.direction().length_squared();
            auto h = dot(r.direction(), oc);
            auto c = oc.length_squared() - radius*radius;

            auto discriminant = h*h - a*c;
            if (discriminant < 0)
                return false;

            auto sqrtd = std::sqrt(discriminant);

            // Find the nearest root that lies in the acceptable range.
            auto root = (h - sqrtd) / a;
            if (root <= ray_tmin || ray_tmax <= root) {
                root = (h + sqrtd) / a;
                if (root <= ray_tmin || ray_tmax <= root)
                    return false;
            }

            rec.t = root;
            rec.p = r.at(rec.t);
            rec.normal = (rec.p - center) / radius;

            return true;
        }

      private:
        point3 center;
        double radius;
    };

    #endif
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [sphere-initial]: <kbd>[sphere.h]</kbd> The sphere class]

(Note here that we use the C++ standard function `std::fmax()`, which returns the maximum of the two
floating-point arguments. Similarly, we will later use `std::fmin()`, which returns the minimum of
the two floating-point arguments.)
</div>


## Front Faces Versus Back Faces
The second design decision for normals is whether they should always point out. At present, the
normal found will always be in the direction of the center to the intersection point (the normal
points out). If the ray intersects the sphere from the outside, the normal points against the ray.
If the ray intersects the sphere from the inside, the normal (which always points out) points with
the ray. Alternatively, we can have the normal always point against the ray. If the ray is outside
the sphere, the normal will point outward, but if the ray is inside the sphere, the normal will
point inward.

  ![Figure [normal-sides]: Possible directions for sphere surface-normal geometry
  ](../images/fig-1.07-normal-sides.jpg)

We need to choose one of these possibilities because we will eventually want to determine which side
of the surface that the ray is coming from. This is important for objects that are rendered
differently on each side, like the text on a two-sided sheet of paper, or for objects that have an
inside and an outside, like glass balls.

If we decide to have the normals always point out, then we will need to determine which side the ray
is on when we color it. We can figure this out by comparing the ray with the normal. If the ray and
the normal face in the same direction, the ray is inside the object, if the ray and the normal face
in the opposite direction, then the ray is outside the object. This can be determined by taking the
dot product of the two vectors, where if their dot is positive, the ray is inside the sphere.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    if (dot(ray_direction, outward_normal) > 0.0) {
        // ray is inside the sphere
        ...
    } else {
        // ray is outside the sphere
        ...
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [ray-normal-comparison]: Comparing the ray and the normal]

<div class='together'>
If we decide to have the normals always point against the ray, we won't be able to use the dot
product to determine which side of the surface the ray is on. Instead, we would need to store that
information:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    bool front_face;
    if (dot(ray_direction, outward_normal) > 0.0) {
        // ray is inside the sphere
        normal = -outward_normal;
        front_face = false;
    } else {
        // ray is outside the sphere
        normal = outward_normal;
        front_face = true;
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [normals-point-against]: Remembering the side of the surface]

</div>

We can set things up so that normals always point “outward” from the surface, or always point
against the incident ray. This decision is determined by whether you want to determine the side of
the surface at the time of geometry intersection or at the time of coloring. In this book we have
more material types than we have geometry types, so we'll go for less work and put the determination
at geometry time. This is simply a matter of preference, and you'll see both implementations in the
literature.

We add the `front_face` bool to the `hit_record` class. We'll also add a function to solve this
calculation for us: `set_face_normal()`. For convenience we will assume that the vector passed to
the new `set_face_normal()` function is of unit length. We could always normalize the parameter
explicitly, but it's more efficient if the geometry code does this, as it's usually easier when you
know more about the specific geometry.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    class hit_record {
      public:
        point3 p;
        vec3 normal;
        double t;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        bool front_face;

        void set_face_normal(const ray& r, const vec3& outward_normal) {
            // Sets the hit record normal vector.
            // NOTE: the parameter `outward_normal` is assumed to have unit length.

            front_face = dot(r.direction(), outward_normal) < 0;
            normal = front_face ? outward_normal : -outward_normal;
        }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    };
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [front-face-tracking]: <kbd>[hittable.h]</kbd> Adding front-face tracking to hit_record]

<div class='together'>
And then we add the surface side determination to the class:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    class sphere : public hittable {
      public:
        ...
        bool hit(const ray& r, double ray_tmin, double ray_tmax, hit_record& rec) const {
            ...

            rec.t = root;
            rec.p = r.at(rec.t);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
            vec3 outward_normal = (rec.p - center) / radius;
            rec.set_face_normal(r, outward_normal);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

            return true;
        }
        ...
    };
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [sphere-final]: <kbd>[sphere.h]</kbd> The sphere class with normal determination]

</div>


## A List of Hittable Objects
We have a generic object called a `hittable` that the ray can intersect with. We now add a class
that stores a list of `hittable`s:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #ifndef HITTABLE_LIST_H
    #define HITTABLE_LIST_H

    #include "hittable.h"

    #include <memory>
    #include <vector>

    using std::make_shared;
    using std::shared_ptr;

    class hittable_list : public hittable {
      public:
        std::vector<shared_ptr<hittable>> objects;

        hittable_list() {}
        hittable_list(shared_ptr<hittable> object) { add(object); }

        void clear() { objects.clear(); }

        void add(shared_ptr<hittable> object) {
            objects.push_back(object);
        }

        bool hit(const ray& r, double ray_tmin, double ray_tmax, hit_record& rec) const override {
            hit_record temp_rec;
            bool hit_anything = false;
            auto closest_so_far = ray_tmax;

            for (const auto& object : objects) {
                if (object->hit(r, ray_tmin, closest_so_far, temp_rec)) {
                    hit_anything = true;
                    closest_so_far = temp_rec.t;
                    rec = temp_rec;
                }
            }

            return hit_anything;
        }
    };

    #endif
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [hittable-list-initial]: <kbd>[hittable_list.h]</kbd> The hittable_list class]


## Some New C++ Features
The `hittable_list` class code uses some C++ features that may trip you up if you're not normally a
C++ programmer: `vector`, `shared_ptr`, and `make_shared`.

`shared_ptr<type>` is a pointer to some allocated type, with reference-counting semantics. Every
time you assign its value to another shared pointer (usually with a simple assignment), the
reference count is incremented. As shared pointers go out of scope (like at the end of a block or
function), the reference count is decremented. Once the count goes to zero, the object is safely
deleted.

<div class='together'>
Typically, a shared pointer is first initialized with a newly-allocated object, something like this:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    shared_ptr<double> double_ptr = make_shared<double>(0.37);
    shared_ptr<vec3>   vec3_ptr   = make_shared<vec3>(1.414214, 2.718281, 1.618034);
    shared_ptr<sphere> sphere_ptr = make_shared<sphere>(point3(0,0,0), 1.0);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [shared-ptr]: An example allocation using shared_ptr]

</div>

`make_shared<thing>(thing_constructor_params ...)` allocates a new instance of type `thing`, using
the constructor parameters. It returns a `shared_ptr<thing>`.

<div class='together'>
Since the type can be automatically deduced by the return type of `make_shared<type>(...)`, the
above lines can be more simply expressed using C++'s `auto` type specifier:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    auto double_ptr = make_shared<double>(0.37);
    auto vec3_ptr   = make_shared<vec3>(1.414214, 2.718281, 1.618034);
    auto sphere_ptr = make_shared<sphere>(point3(0,0,0), 1.0);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [shared-ptr-auto]: An example allocation using shared_ptr with auto type]

</div>

We'll use shared pointers in our code, because it allows multiple geometries to share a common
instance (for example, a bunch of spheres that all use the same color material), and because it
makes memory management automatic and easier to reason about.

`std::shared_ptr` is included with the `<memory>` header.

The second C++ feature you may be unfamiliar with is `std::vector`. This is a generic array-like
collection of an arbitrary type. Above, we use a collection of pointers to `hittable`. `std::vector`
automatically grows as more values are added: `objects.push_back(object)` adds a value to the end of
the `std::vector` member variable `objects`.

`std::vector` is included with the `<vector>` header.

Finally, the `using` statements in listing [hittable-list-initial] tell the compiler that we'll be
getting `shared_ptr` and `make_shared` from the `std` library, so we don't need to prefix these with
`std::` every time we reference them.


## Common Constants and Utility Functions
We need some math constants that we conveniently define in their own header file. For now we only
need infinity, but we will also throw our own definition of pi in there, which we will need later.
We'll also throw common useful constants and future utility functions in here. This new header,
`rtweekend.h`, will be our general main header file.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #ifndef RTWEEKEND_H
    #define RTWEEKEND_H

    #include <cmath>
    #include <iostream>
    #include <limits>
    #include <memory>


    // C++ Std Usings

    using std::make_shared;
    using std::shared_ptr;

    // Constants

    const double infinity = std::numeric_limits<double>::infinity();
    const double pi = 3.1415926535897932385;

    // Utility Functions

    inline double degrees_to_radians(double degrees) {
        return degrees * pi / 180.0;
    }

    // Common Headers

    #include "color.h"
    #include "ray.h"
    #include "vec3.h"

    #endif
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [rtweekend-initial]: <kbd>[rtweekend.h]</kbd> The rtweekend.h common header]

Program files will include `rtweekend.h` first, so all other header files (where the bulk of our
code will reside) can implicitly assume that `rtweekend.h` has already been included. Header files
still need to explicitly include any other necessary header files. We'll make some updates with
these assumptions in mind.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    #include <iostream>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [assume-rtw-color]: <kbd>[color.h]</kbd> Assume rtweekend.h inclusion for color.h]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    #include "ray.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [assume-rtw-hittable]: <kbd>[hittable.h]</kbd> Assume rtweekend.h inclusion for hittable.h]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    #include <memory>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #include <vector>


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    using std::make_shared;
    using std::shared_ptr;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [assume-rtw-hittable-list]: <kbd>[hittable_list.h]</kbd> Assume rtweekend.h inclusion for hittable_list.h]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    #include "vec3.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [assume-rtw-sphere]: <kbd>[sphere.h]</kbd> Assume rtweekend.h inclusion for sphere.h]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    #include <cmath>
    #include <iostream>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [assume-rtw-vec3]: <kbd>[vec3.h]</kbd> Assume rtweekend.h inclusion for vec3.h]

<div class='together'>
And now the new main:

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    #include "rtweekend.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    #include "color.h"
    #include "ray.h"
    #include "vec3.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    #include "hittable.h"
    #include "hittable_list.h"
    #include "sphere.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    #include <iostream>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ delete
    double hit_sphere(const point3& center, double radius, const ray& r) {
        ...
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    color ray_color(const ray& r, const hittable& world) {
        hit_record rec;
        if (world.hit(r, 0, infinity, rec)) {
            return 0.5 * (rec.normal + color(1,1,1));
        }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        vec3 unit_direction = unit_vector(r.direction());
        auto a = 0.5*(unit_direction.y() + 1.0);
        return (1.0-a)*color(1.0, 1.0, 1.0) + a*color(0.5, 0.7, 1.0);
    }

    int main() {

        // Image

        auto aspect_ratio = 16.0 / 9.0;
        int image_width = 400;

        // Calculate the image height, and ensure that it's at least 1.
        int image_height = int(image_width / aspect_ratio);
        image_height = (image_height < 1) ? 1 : image_height;


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        // World

        hittable_list world;

        world.add(make_shared<sphere>(point3(0,0,-1), 0.5));
        world.add(make_shared<sphere>(point3(0,-100.5,-1), 100));
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

        // Camera

        auto focal_length = 1.0;
        auto viewport_height = 2.0;
        auto viewport_width = viewport_height * (double(image_width)/image_height);
        auto camera_center = point3(0, 0, 0);

        // Calculate the vectors across the horizontal and down the vertical viewport edges.
        auto viewport_u = vec3(viewport_width, 0, 0);
        auto viewport_v = vec3(0, -viewport_height, 0);

        // Calculate the horizontal and vertical delta vectors from pixel to pixel.
        auto pixel_delta_u = viewport_u / image_width;
        auto pixel_delta_v = viewport_v / image_height;

        // Calculate the location of the upper left pixel.
        auto viewport_upper_left = camera_center
                                 - vec3(0, 0, focal_length) - viewport_u/2 - viewport_v/2;
        auto pixel00_loc = viewport_upper_left + 0.5 * (pixel_delta_u + pixel_delta_v);

        // Render

        std::cout << "P3\n" << image_width << ' ' << image_height << "\n255\n";

        for (int j = 0; j < image_height; j++) {
            std::clog << "\rScanlines remaining: " << (image_height - j) << ' ' << std::flush;
            for (int i = 0; i < image_width; i++) {
                auto pixel_center = pixel00_loc + (i * pixel_delta_u) + (j * pixel_delta_v);
                auto ray_direction = pixel_center - camera_center;
                ray r(camera_center, ray_direction);


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
                color pixel_color = ray_color(r, world);
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
                write_color(std::cout, pixel_color);
            }
        }

        std::clog << "\rDone.                 \n";
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [main-with-rtweekend-h]: <kbd>[main.cc]</kbd> The new main with hittables]

</div>

This yields a picture that is really just a visualization of where the spheres are located along
with their surface normal. This is often a great way to view any flaws or specific characteristics
of a geometric model.

  ![Image 5: Resulting render of normals-colored sphere with ground](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAADhCAIAAABp1HRLAAAgAElEQVR42u2dfcwtx13ff9/Zfe6L7RICTWhCQqObNDRExaSQ+CUxIFGCE0AtUCFQpbSirRpVldr/SEmQ2qq0tKrUqn9UqKVVE4RApOSF+OXeJCY2xvf62rFdG6V5s90kQEITCmkQ2Pc+Z+fXP3Zmd2Z3ds/s7sy+nDOjR/a55zlnz+6emc/z/X3nN7/BLz3M1NvY8Yh6n7NfwH4Hdz3FEc6q53x6Tobj3J/BN2fILRp0q2nKcSY0BHobxr0VY84KGH5F2H9kjLq6npMJcCbDbzUw6huH7/eYY18vrF/gein29ePyArpGpuOQxhF7zs3nrHjg+XSezKAzsV+HyTfH8fbWLfLhCNrQwRgUgZZomHom0zk1BlXwg84KUTX8ho/h+BBUlS/IfcbV3mEZZGRyx7MxYBEJW10MnXJz+t5u/AJDsAMnpkbxa05CjcAlAh12NKrgeXrxUDUZmlElpz+qlMJqd3ovbA2XNnNgayAsgmOrX/r53JyJgmsoufowhcjRoN+AQJDjxeFUQtWcqCr/kY+IMvrVxMSR6f70mBpnEWxFFFxjybVfZs0SDSLgeydwMJJRNTOqYpzJDEZVT/ye740yRseJseytOBpnCraCG23+2BpErhEiqatv8aJg8lcWIz40uqd+uKiKIakaLce+KGN1ceLasEWx5gd84kRfck2TXfFwM4OYCsIpWsLJPlJU9cbv+0x3PykRKk4cja0RsJiCLYozmRiRXL2yi5Z22McjcmlOUYTpvxioipepEC/6cz6de/X4ueJEH3srrMYZhy2KM5nodXv3hYoDyLVufmEshDzVX1QjZo2oCqfv5on+nEfIfUcjjTHmY8SJwTSOH0ZHMnRoxBpBcPm6V64XIY5vNRIx4SAVW1LRRpKqFoz+JibE5WP+UHsLrmXjxD0aZ8bUrdiCay+5xsCrG6NLKKupPhpGUw8BxuExGFWRJFUTWP7mSBjBFScdfNOu/HTBNYhcNGjesKcT8RxUmvi+6ZyaQodDRtVckqpxerm/ORJbcEWyt8D7Nc4aXHl/weVJrhHwGkahtaZlAdOOPEIyHKVRNY+kQn8eVkDBNXF94qrsrTkZSt4LofbyZZDsWsS9CgjAUJxaRFLFQNUqor/QawxyGhWI+QiuIHEiLTKF1/rs0ScTWHBNJtcgePl3L47PoymQCsKpVUmq+U4maPQ3PdEkx2RnZKLgmmI8T5zCozWkQXgLriDkancIDiGfZssjBQKdWLicxq1kVG1UUjUOklMgT3cewRUmToyfvTWAoTQtO7ebXL7CJwK/FiTUnrERP1HoEKK/GSXV0FmR3N88mhQqBhJchx8n0gATsJ9cNGohTrsDzYkwTJBqoTi1Nkm1SPQXVXWOQ5UGFiZNRY0MFWMKrhXOJ44jFzzqnQ4lF41Y/+zRsbymIyPEjf4ZpwtyitY/97diSdX4RU7TbJGRoeLSgmvmdHkKUQtsDLn2wYsCzQBiLhMLA1+BoceMLamWi/6WlVQTOVUrLMcamgnkGu3NT5zpj2fMx0iXnxgqepLLB140b52+8HgaC6monKI1FfYLJqnmLILY/bXm7qGCvj/OC3rz8wmuQHHiguTaA6/uNy+SioVprw64CcWGdqCIJ6kWD/26XpOP8ETWEypuXXDRuH0ozK/TewediZtQLFwAa9omFMvuQHFIkmopTnUCKxK5InnzaxdcNGxKkQLtoDMIXp36a8HgcPIeObSC7SeSpArIKcvD8uzcU8h1qILLedh4Sya9yEXDtv8ahrBQOMPE308SU7RcTff50j5XI6mCcKp6mW/i6ErI5SNw5hRc00PF6eTqhxd4JGT2V3MPESUi+BFWWdB91ZJqC5wyQsIJVu7obQr9B+TUUHFNOVyRyEVDyrpPz2lYXTV3il4oeREuRLfMKPycg8/tomnTuHm/GzKYXKFNrnih4mhM+ORwUYTK7j4LmPfYWC1cbaKyO4ZDaEXV3FPohwCcMhRWLyQGkSuFioNDRZpjT4rR/JoZZJhAoK2XSE6hn6f5mHtubzc+2XpOcm03VJxMLppe3707/2rWMDBCieSN1h2NF/ptjlNoK6yNkmsboWJ8co2G157DelIhfkGsGMWRt8ipqJJqtZzqCwm3Ra5thIrDT4n2OfQUs1Dy4EgwqAYbn9OwguLIWwz91s+pXg/LZ2wcKrkGqpuoxRgcZzUZXjS5XHIQYyvYPvWrqTiaODWRU57fZO6zMScNzLSeh1xx7fkZVzWHrThKQ8ol04RyV4vkNwwqCxG+kt8W1khTpLTYRTlVnXM+2v6YuEZkOrmWsufjrWreuzDQHTDSpKKjzr67hrqj40rWrKHcKG3TSkfw+zaZU/BJaxi6q/DENSLLkMtbGC5CrkH3zR9e/nFcf88OhTPMkCsfWhQkTkUypzxPOPd520hyBRmBR0Mu6lj14lOPoRNegfgVAzQzEGoeSB0qp+Yx0Yf2q9y/jvteeEUx6Q+RXLSaAn4L7kIY0iZbXwG/xKmAkDIPmPuMtCgB43GQa0HZ5dBTfvlX8SYHxyNp2hheUkwlToXgVGdIOGKyaTFyUeSyLSHIRVGnDlrwGsQvN8JoTZX8JhfGWqwq1po5tdxk39REuUa1hgHmVMCAcaxfM3UJMXtkky5BrmGyqx0Qedcg7QwJVyOxMP2Q0UpiLcgpjLtvoU302GLK+TujgF+ITaLmlF1Tl7PAeMHQtc0j8rnCBYwUuRjWHl6tI6l9hIyi+KVmaIV5nuvm1NAplJzG2rRhZVcQco2TNjRLDn0k2UX9E39tN3psPb9lQsJpeAo4uhbcIyv2uQXkVFgxNcrDCpGdOLQWSpiAcdRCvHnSPifKLppSVWYfwmKEfSHF1xbrzNBc2/OMY+gaxJT3PK/XWsJQMeMisiuGSe8/ixdphbP/8prBVbFcsWQMoiHAKwITipZeF03xTfSZxVTwpLn9m1DEjhknya74VtfE5KmJssvzj8GUwjL+FHP8niOxKtj7Yu86NYOYmodTKxRTzrfmNHTpWeiYcZLsGhIwBtQ188muafDyQRjRhEKjcQyt2OVlaAXFGzYU9C0OKTsk7N6kYDy8JseM88muaQEjLbfI2X+RTaTyMv6Ai+fTB3d5l10UvTkxFXYhZ+eL0eVhhYLX5JjxCGXXYHgF4tdQipXt8VddFjITDLAQBMEAkSAIpvIBiAQxiASqByyIASnAQhQvePr2SGwK/gd/mfz47YupGCm+3R5WCHjNFjNuS3YFgRcFLdKwtzzD5Vc+JIpccCZYgCGevxFcJjCieuD+JBATgZiJGFw9+NrLnwBYQAoUItudfeaNiFpDed6yDRsSUwtGfBh4ut4e1lh4xTO8FpBdFDIFIXiRhpILnvqLvO3y+7/lqpCZYCGevxEswCACGCAQl1cJj02i667DxCBiMBMDzMQMZsjrL3tcQApRZF+4JSyeaK7l0LSp3M6pEd+MkLI9rKFm0zrgFUZ2Dan2GSlm9IKXfWhPq2hQnZnGqz7ysquZzAULce2cIAEGWNSQYqgDqM9A31eL1uHVTWdGDS+GlGAiSS95QkBmYid/7xZaumADxUuOp7G5nccHqT5gDQsrZoRX7JhxZFYqzbUT6uRSDQ4J1nr/3S+7khUnQmbi+jmwMCSVKN9vCquSXJpYcB8T9XNlMAgVGNZSC5XygqwEl0QuvukJIYosO73+e7f1d+fxXknMwX8gEd8skPI/bA74Gq5YFF7RDa/lYkafsNFTfNHAag0VxX7jL1zNilxcOw/OSk6VFjkpi0oZVeaD9vXD9SHckHr1zWUmArh6wCTUP8EMqci1y8+8+LEs2z33B7fQiM2+/EZGXHmSIDUNUuZ15TRq2vvw4LWg4RVQfJErSb3/nr//xY9kRS6unwNnKvRzeFUgIhNVltHu/sLI2QlqqVUFhopWhBJVytsSGluCkcsiP/+Nj2fZ7k+//AYaSOQpA2YlkApin20RUsNquh8VvILEYoPg5SW+2Gu6sEt/9auw9/75q5k8EdfPalUlwAAJsIZUiS0V+pnMshQW9p8a6v+Bze2HGrRC7W2VOkswSfUAmSyyG7/h8Uycfu0Pb4k0VEATHJYEqTiQ8vWwRoivYStvR8UyBwMv8pvigN/9H3Tnf+UbHs7kmez0HKRGlXLWQVTTCgRjErCeDUTTEvNfuMLGuxnW3zE2phFZe1vMBINcgpFJkb3ghY9n4vof/9GtQcbJPMt3Ng2pBQnV8rA8xM6qxNfW4dU0v0eLL+/40Tzmu7/xwZPd+ez0nJCZLayUs26lLFTCqnLcq2Nzg6XkV1q5klqsL4aZAGIGtCtvzR7q1AfJBIZgSJZCQpAQL3zBx0/y5778f+9AhOGxqr35jhxS5kfkg4b3TOJrFLwo6A7J413wKZvcDM9cH/QtvOfrHsmv3WSjSoWBpr/uMK2MSBDNkx7a/w1ygUEwZBcrfukgkTSzqNRZJBlQP1JIiF2RvejrHvnDr70h4minBZJO5wfrUEjNQCjnp+SDyTKD+Bpb8zcSCKLmT/mIr9H8qs7/v3z9gyenN2SnZwXbwqrOrjJnA6scq7a8agaDLU+rfiXrl5qulSZU9W7WtpYSWfpPVvl8nVxavoDL/5ZSC0JKAYgX3fjYycmfffGrdyyyLzStMpkz4MYc88uoXg9rn/wYwa8p4qs/chxpe/ktwZstSZXGJa/zyC/lF2+6ml+7SchcsIDMQDWtTMeqzmAoL5rLS4cZe6OOB9tnAQ9hVd0JNctYxoPG9erAEOVroBVWw9XSUosgBSDFToqX3HT1D/70ltmG+iogtbJYLwahGi+yPSyPcRCbX6Nt+3kix0j5UxMX3/RUufrP5x7Nrp8VnIMzSFHRSq9H3uOvUyuhoeNsfBxntu8jG91ORYLWi6HfouBVJz2U4aSODcFCSgkUeMm5R7/0/OtpoYU7m4n1NkWo/R7WnPwK6HwFEF/xI0cKuvhm7/rBXzh5LDs9IzgHC3BGZS5oba6b1lUji93hslthn/WJ/kOejZQGNE+XYXnwXDpZ0JnxqNNKdcYplafPYJAEIPHSk8e+dPqd0/FEsxcRjigAF3WjJhJqv4dFXWk+EfgVMnicLr78QrCJ/rdX8Ei++etdCPuPZx462Z3PdidQtBKO9AW3yw7jQFZ2aJWEVT/j5lffKTKbfpZ+oPVWa8VcGRLqyBH6xST0Ih4wyVIvloJLSrw0e/wkf+7z199Iy/nNxyyjxhHK80PycSexBn7NKr5oWP7BuOCRuvM/PSVY+cr/kF/Jr98gOIfMBDczrUphVbvsZiRIzVQG+1TQLam6+xubjzr6aeMLUvJKQapUXup5Mj141slZYAIDEgBIMgqJV+RXPr+7bfrwnql2cGQ3aruEagLLf5P6DfNrVMLqCOcrrP7aI8E6VNi/x8P56Tkhc8jcQJWoLHZjKtBiFtQzlntVXTnc5DL/3dcDSwfdcS1sk8zml+G+Ux0kVnIMRCRITSMSg5iIQSwhBRV87hXi4c/xrbTQzmAbCvTWTKjGe/Oqi4wumXSM/Aqdf+Cf/9m/7eC/46snu3NC5tDpC8q3UqpK2DFg22WvVjiTldROZKe593S/rlNG6zlm8zagFTA2xJeRClZ68FRnPEiCUL8qf5ikRCFwIbv6v3HLdDwlQs1JqJ7lmXlPNxuNMMcbPY61Qn6FNb8oxM4RPTfy3xYPnxTnYEaCZK8QbCQxOGrFmC67K8XKCo1HDjquqpBSd0UeWOJLJTgYHnx5gjo3QpROPINLnSWh8iMKSa/MHn4muzUSnmi5xKiFCTULnoZ4WK6hNi6ndJwEWwO/RprfQ/IPQiHs53cP58VZIfMyNZRql93KtzJiQLgyGKwcUThW4XTkXvGgTsD2G+vc0VLblQsK2VR03AKZRpiNLckkNJlJMgFU8NlX8cPP5LfOiacD1FALEarTw9rT8WaWYOzz+Zvxv4KkgPYg7OdOL5/ZnRd8gmrZDZXBYIUqYftWZNWNcSQxwKGt1OVjZHdjdqGLga7ifyoBXmVkQedr1bQqDa5GYMhk+lkgyVRIejVf/szJ7SMGc1wBtRChRoR4i+CJBpVIXhBhwUNItF7NQfhFAybvxkmwvSrsn1/77bO7G6B9K2pkMNgKy1gY2HhMDbWF5jfRm9funqPlPd+BdS/qFYXK2+KOg8F6XAkxrbCIIVivLCo3vWDwjs+9hn/7U2ffNH4Yx8znGnPMsIQKJKDC4mlISBgHYbNJMN73AfALuGiI8z09f8pHhTUOe3J6XsgTYRSKMbWVttstr91cdgMbW+1sBrtKX3cG1t6rZOtmo1mdug4GK36pcI/rDwcxs16CCG3S1w8EkSQ1e1jpLJbIwHTK5+nsvHjaTogXUkCFw9MYYIVF2NB6mKMl2FpCyAkIc7y4JcT+xZ98/ESe0ZFgZudbOacFzdTQNqdakSC3/6I7z7TbzIIR/TmOoABUiyyj2F9VBV6ti24coJJoBrYYgrnUWaikVqmzJJ+8+k8+/tk/910Bh+5K1uUtKaBi4snlYYXYVnN+hI2YiByEsEEbvg9NPhhfhd0WYv/s/z1yUpyFUYCBtMsOArUiQS95ReTw3R1I8u5+3Mt5mNOEZYmGtgffJbLK3KyGyCIqY0MWDEkkGHr2kLmQJ9/6tUc+/YI3JDytH0/Oe5JPH67+p8sJYX4I8xFi7/rqlTPFeXCmqobWa26EtbDZU15Rp9HuUf3Kv3OyS0MaiVqwS9FUxWmgE999RBYRVGwodAmtUmplLLjgM9/21Suf/Prbwo7VY8ZTEOnkeU/yKYeLJcQ8EEZDNqBeJ8JoYCH2xhPZ7iyMUnxEguraoVXKQktekb34hsy6V502lsv0A/GEQWGb6hWcWgaWropVc0qvji5FFljBrCGymJj0DmIQpM0s5ozBBZ+djU3rxNMUaxxzsakjJBxiJAWnmK8Qcy7m5g0gLDzFiIjpnV959ESebdU47pVXrTWD9trmBqRappXDzBrXgVU+qJHmbsaGhh+vDazK2GIyK9AYEgz61w2RxZJKS0stNix34skk82u+8uinXvT6KTt6BhmKi+FpC2xynkw+OIJbgmLxYsmerfqCIGxEfL33u3jHV1QwKHQGA7Eg2iuvqO1hUZfXTt31ZKb25PaaTDM2NFeKoe2+lylZJbmUh0WkV0r3iizlvrMEC2QFn7z2K1c+8eLbJoFglTN3S+EpOJsGh4Tw8CHmodhoITbIHuo8zL49k4fivuur9dRiWXEWMhOlxe6QV2jJKzIllbtEX12qgdxOlkNtOc6u7av35Wu5lwvW0kljSBtYxu7R6r1s1oMnNeFYi6zyTVpkMRiCKmbRWUQbioctnUKxaVRaw/BcT2ydYsMdMS8hNo1injfkp7/4yIk8Z+4iYaRcGbmgLVT1Tgs6FJa57LmnIPKgPsd2xUMzzOS6KIQuoGwuw2lY75pcatKwChUtbOkKESWaAWPGUAWG3/bFR/7XS9+wVTb5HWi7bHK+Ld+/ys9vtIWSY3NQLJojNo5i/nLsn/z+g+eKmyCVy17uJl/lMejcK2OTmxpVloHl4lTnBvSNysgTSm9y+5ajGRh2zxgqpjknDXUChIEtUkWzSOVklVkOWmQxMUNIPvmOLz745DffEWzILTphtwY2IfTbBi/NWQPIFqEYOs6SR3W1ICA72Z0XspkgauUr2GubHWtxDN8Kw+LB9oo/TOiV3FJp3HysKiYTbG2lJw2rou9GbKhfQXq9IVmKTdX5Y5QFSzPJ8pTPrwtMG2FTbDCN8bDmBxmHuOmeIBuvxYL4YsNB9o8/f/msvMHYqxmmYwU72crwsIioqzifRzxobU8fZLA0Lt6e9msxph0V1mY8V1uBGeukbWypfVlJbWJBAHG53Y6eMaT85s9ffuov3h4VTEv5TYuJJkS5HBq3NMfz4xnewUF8OUbDd0scLMcigywrzmha6VJWrTp84PpMDLnUWGFjcQrteLBzG3qE6IHseruRyV5JLXONTkNbOfwsIzGiym/Qu/Gor7/03UnhvfTgmbOCzyQwjTmBaFTqA1bAqcB4oiyB7B89c/lscUNttKsaDML22u0HTVS540G7yqhHPNgZIXr2CfdOhY6oUO+so+b7qNZW3VEhNbK76tIO0FiHYLUCqBRZQnL+Hc9cfvKVtycwrQdM6FRYHaERhvyVjC7KePihNgEyb5ssL87oegzQtEKtFgio97ypZVe9Z5dVyqqrpMw+WvH+2u1ur8r9r8bkIDULx5jIqbYFs8llRIVVjlZ5wHoRos5xh3bfS6klqHwSQiLb0ZmABtMawBQwjsO8SOp/RT6OBJiZZT3rQKKJshggG2CTGS99+2cePFfcVC3BKbdBbRrq5sCvydIxP9iTL2quwmH0ZzJ6FJlxVPFxHJOrmlio4GpsCg1r0WAjg5SaKe9UY0urr6pODYMA5tKaK9UWl4HhX/3Mg0+8+o45qbQMmLZAJa+QkIOcQjRpFopl01Hb08kmsow61kjnxTnRcK+s/SMaBflgrL8hlznVmh+0IRXNvaLeEu5dTpYFr3qukHWSFRo4MwJPK8TUS3xY1avR7nslss75b+eZqBQPSf3HyMcMpDg4O2yWTcGZKBy00sEgod5bsA60qJoZrHjUUy+C/ULC/tMclu6BDmy5irfb8Gq9QGlBrb7KtdBs6qryBUzEzGVmg1o9zbX7LjnDckjaNpVmvPw81OF48lHA4aVZ/76V/jgLQvNxOHv77zx8Vp436zE4d5Fw5DS0YNR0oLrqyfSlX2FkB2HqLu7H9tqeDhuLGskNVa/R6e4W1GBlNphRJpU5pSA1Y1iaWUIiu/l3Hn7yr9yakBTjI0Odcz7TBfuM6oQzV8tkDqkT2e1tUO3qC+3ttOzFg/WFwcWvvoLI3Sc4rv5dY0cOwE7Iqr5sp43VSG6w1khXue+w6jFXi36MsFLPWHC1laEoOupZJiTNxiMPDytEoas5iLa3RFFooo3EGe2v7jDo9MrcK70fqrlpMzUmB1up7c7ixWjP9KFjRQ6GRoXDbq07HlRLBFv8MuBFLXKZ2/owKjEIY/V1NV1YF3dAlUpKEAzBMgs8JmdMCDgMHu39E577vzQ217ZFtL27P/GQD+s62t9/7OoZPlfXaK9T2y251M72gqW8sAc63O9bIU7vbWML7r1xWlRywI71jKGeZYS5M5I1Xag8e0thKZ0lbn7s6lPfeUvi0fwkmiMkBGaF2kSp4lVGMhzUPPez6+eakLkpr4xYp1nvGJbIclhOzUzRzv27BtKKfS66Z9kkvJjVIJcdDLKpDFVCKRmWlRkV1usKy5x4PW+oRJZEPjOJEoyW8bAmXkAorm0Lanu5VhZmaFfm6yir4OBUqwxD1+fvSRklRyDpf8tNQjtTsboEVGtRYZX7zi3zrU4oJSPRtHVnqrXRhMrMqlfqQIQdcgcDIywSFjo8LO+X8jpux3S0YeL1ehb8nsy1n7py5SzfYNRjqOwqgk58JNvU6TxLTTE09kltDnp0UC+gjdVtYLH9zya/HFqMVRpoi00Gudi+Wp3yrkvQVMlZADMkxM1Xrjx5221HQqKVYMj/LPJ4N5E3jrapKB+0kYHrEELmjXoMGkywEdNcP2jmXvUupkG3bGwSDYHHlEWfKqfT+ic3Jy+4DmydC5qUHDNzsqzbayTFa1Spgn+lwioFl0SOOBQ5HgxFXPwcb9EglqbbCtE2iG6QquiVmctuFXvhjh3LuStZAb2Bnn8F91AVZtjPz7KXE7rCQCsBgp2JptrJMtMmWE20kl6swxDMYubNQTeBIazjk/KhG7dEYs+y8m1oV+BZOK6WOut0dqtijMNQb0RF6I4NB50IYvbb/onCni8Ajl2wXYxjIwGrZcxr313nwZOeK0QC0Ao+Bv4h4bhP4QBvjngfeNGuNpRxb7v/8lm+US/EMcvFtGtX2esHh135oEU5/fkao7Q6yG+isMvJclWpaX+G5dDb66hRx9R6sY64+f7LT37v7Yk+UdEzNiRcx13j0W/muKcXCnODt4SSOSxamfFN9xShtey5waDW3hPBrtx/onD4DtedZ6frNDSrzZDhwbc+1JwoNFSYlmHVdGG+FICw1g9YhzsfP60h+u3AWKZw9O9pUqUdqVPb61JWNbn0nDy1o8Ke0+80zrlZFtk7GBxX1p33+Vmm425kNsAhsjqTJNpZo/r1zODyA/SMK+kyylpqiYPUOyuBziRgYYnRuArYYfK1cMT+AVnODNajyqjBsPfsgf4T4KFnOJ5W7AblXma5j8U9myAaH2dNO7pjxqrYH9dStS7yF1lgHStupl9LPtruDnv7eIu3D+Guor1Yx8hut9cGWm8BNQ0suHnsmiUc4F553TMMu3fs/YIOA4vteLBV9YFbd6OqPNOcKeXqb4GysQ4vmFpprDq0gN8qTpzDH5W39aXCobBarEF3ReNGiOdzUvA+Hcx4/7hbl3nwjuFaBuQy9a2ay/YfBhAzgMSXNaI3xxqGOmIeMvT1zHB/fuKuh87xjUYFPuzZ0ppDCZ/h8mr8WqRBImtU7Mn2QZwfXcu40iFDWV355rseevKH3ri9jn9IcaPravI1XDJvqlMg/mVACnNmEM5Yj/siuvFXvr/mPMJ92XtzR0dXdXG48sxt/wtVwgmbaxAJzEGzsXCY+FhAYaUbweu7jGp3nN6hPvQ8+gPGhXtjZwzIDQb5BH0eGs0dPKpflYXeV0iZw9JPmwVW6gQthWUmHGDM6O+8RBzUOOHecjSDl4Oi3meWkeiwRmCt4WthTl+E3aQTGtMTMVaId0S8GN99MVZyb1f/p30Npnu6EWsVDuiukhr1fq3qy4iKM/fBdRYtUrdMIWFq4xTWoQ0dphUbRElhJWClNmzoyJVEdlhChnmqKkRFS6LWSoGVZO8aBUj04cLe1aQxu0TioC8bT800NJLCmvwn/9hCQswxONO3bd1kTn1yvZozJ6QevE6JxdzZSzjmPC40/xcAABhDSURBVMWq/CWOfJO7uiJPqXh0mF1yc5tQpLacwlJDyNcYjvil8paWvbP/63htUiKJ4nWHhEfyTXhueia5Xk4yoj4G91BmjDrj1UpgSyVNIA03yTWgxMyMgEsszY+OGluQlMySS1Shq7f2cKcLL+yqccxGUT0seH+wHyU9Y5YHD3Du+xWIQXKFPQrLMWwlrMzXMqi3E5rOcKYspd6BSvcVmJ6wxZ1q3z12LD6cvqynfRD7mUnbh3CccdGxWpLdr4Tx23pJFEtsggJzDRzMTiznB/p5WBs0ujbtzb3/H7zxJ3/hfzIxgevtQJsX5rS0uF2xfTi32GNHielplhx2OHeoj32KzLh1qiYWMxF96u1v3HQv5S2OKI+VoGmWMOhVhLsMZWOVQw6VvcJ1mU20ydIR9AFDqcTNxXXzfD/+e5DxkECPHf+sWca1dcXDDSyvAP8QBhSv46TzI0dMcNCE6+WSmJUQZxWusGPcmUMLNrRgCw2zlLALc829GrxF1hiwDZJXHQYWs/Ekd8V6JpXAHYUsTH7xEANrxt61bI2AlcwNH0Jaw2oXqU7acUcyg1krLDYIVe4A6g7KjNrl2F9kqt5ndFSQ6AUo+HZXn/1TfWuhNk2+jo+r+FXdNr2FDi+1W1LUfr6esigTNqFI0FlESHYf964LPw0Cyx8lsJqyUthSqVjMKjg0K4+zuUmopRzQDZhKjXFpqlobYqEj3nSMTUweyy191LSWOnUWemDseg10FWSY4qt6hkshJu9/5TtA/D3P/psRWFoh7KaPMl5LpvtxcGcR9Hzowjvg2JWqf69AEpQREcsdQ2+gZ8wY2mFf22KvtjU2XobmhqNMjLE2UffU+qidn3n0XW/Hg+zKgWhvE82NoLomV5nQwAzeMQkm+tiFn9l39dwCIn/3sz8/GkjLbvcbY2iHJR0e/CxviztL0YeIfuPCP0X3HeqZ6seoT373P/ybJziTIc8pyygTEBkJUf4AgoQgVD8gCOgH6r+kH5NQm8NAQO3Aqp+pH+i3VC+oH7f/aTxj/QiPZ1pPsv2M+c/qMes3Nh6w4Opl1X+5fIt+zIL1g/pHCmZBUpDMSAqWGRU5FRnvTvj6u//T/wjyDZqVTF0vVrC749l/PT+N1p+D6iRdDhwvgCoMUXMXZffbMhK9H4WwF6vSR8EMtaU6VwqLLe+8igfZ2nYVjlDOTIDAiIINHPTrGpuHxXtDy4Z6ashQNmwsJYvKeBDKcYfPaWH/a9D1SzPr64EL7+xVkTXg9qBtyC3E6gHn7J759hjkd+gPXviZLjWEZggmWruQBrsujDqMIo2UDMUsHdkxswGayntCezybwSDpGNCMDe09AHsYtzd3NBatmvTpeIGdV+sIDA1Tzn4eXCWLECmvXUIvjMIoanakkKDvi+68QbBfww20oVu1venZfxUWQlgH3fINMagikTlCnVt+olcNDSlehxluTtcbpdwRzhCYuZwxZO1ccaWPWEkD60B6ipDB2krvTsVquvX1UDbfw61DcEBzuZE8Bos77RvVmYQFQ5ig9rBYL8lkY71A/RjauipfKXjX9TE++8vykK+4Z0sf12vgcU8r1fau/n0ry/vjxbU10Q0PPR1Z62HAqz5w4Z0NMwgjjzog0kXEy5r63nf/vR89wZkceUZZhkyQyEgIiNrAgrBsLIJAw8CqHhMIgOFnWXZV29IyHqP5K6er5edhcftJZUgxNYwq5VK1HliOFZNhWpnWVelwGU6W8rOkYWPJrLSxuMioyEsD6xfft6o+MO5d2IcCeLyxfM0dz/4cDap8EbPlM9xvE0b9AZpozqlhluhs+hsR6dNVVAitsMrkBkNhOSYKmewFOs4wsJ330Js+6tpAns29Xv2VBHcnIjj+6c5pQJcpZOU0sOtz2IjnuJ4ZVJODEiz9vyse/P3yOCG2lwboVVsD49Dmax648K69QWgNtekpLsOAhTEj+QMX3tljA5XoEa4YDXFYgwnHCBX2BjmOlDtGTpAEoTJIa1eKNf+VH28sgUY9Pi1j3oAXG4RCj0W1z8/iiX2wj1bdrpGVzYAOZwlWgru5/oZNx109wxIsq3hw4mVgVKfgsb2InZ7deOqhB2dwYfGBCz/rrPFnhqUl1Khn6tTjdPHQM9x/X99vBcPuyXuEGLfjKIMVYCWewQei9/ztHymTGzJkGWWZigdFVmU2QKCV31BGcOU/VTSngkFHJGiEfjCCNetxK46DZxJD9zPc9YxoPOZWKoMVJHIZGBq/ZRUw2tkMqONBmVU5DSwzKjJWCQ3veff7I32P6zkUBuOXQhksbVutwZY3Pfsv+8Gaf8DiEVx5jBhyHvt/g+W+cqy1F/YcmWXBQhJLgiBlvZfThWCUWQ8MshcQltIcZCWvc+U2A83gjmFmopL5yg5hNSm/oW9pDshdlg8tLdZ6paG2VPTHoEboV668IUt5MRNLkIQsKE5Jdw7Xc3hyP/SIRr2yOrpD0c7a0+0JhMa23b914Wf7PbVceM3og+YyjNYWlM1DKOrIgyeiQu5yOmE9V0iWmYV67tuICq3gCDDgYgaDDXI1EiDIxa92rtmg0d3Vj7krroRjOY7JqcZ/zYjPGd5w/UY1S6jsQRCDZSZ3DZPOcs1Wya8gCAvtqaGbZdTLso6KZbpfM1GOfStFDj0iw4KQ8jn+T/3yvb/0t/46IyNIYjBK1rBRywGaJvprhzFlYeRkMdnaihvFG/aVbeAeYcWjVub0p2K1aMXtwgxs50CYXLOzGdjgmkrFLf8riUr3qvhvv3xv11cUdSedgeY9z4Ow0RQbKsqotwp4Y4ogx1xkQdA3YTmCzP8psihYyGppIYPLJCsVH6LMH0WlSWBUnjFzsmwlbmdZNQ34/lIzLmzx9LHgohV3FUdm2/itc69aNRjUC6BzIEpNB2vxoBSyGHTekfqJh/hCEPRgLBN5Wpce+vbG6/NwwxXxvkishh2LfNaueD6nnJExhCpDWseDesEOuEUSHVHB4FEpxwiAtQraZWOZs4dOYTVi8PpVa2hBCs0HlQ9lCzErbYCNCUGuXK3y4IpWOhgUXOTF8+MQELX/cLS+2ouwMEykjkVhU0Am9IyP+qEhP7B+gm2W2/6kGODAjLv7Tvysv/vej3JRsJQsJbFkySSZJRMzybLWjHqgRqgklkTM6kcSlS9mYq5eTySZ1MtIPalGtH6m/BRJ6kcdsJ1AzvaPUcWz9StYvyXjDIkkQVZXVJfRsc7QPm2wcfnGJUOdsP44ffnlg/JTIJlYQkpIiaL4r+/96OiRz3MtteOYH8etn6DHRPUzCDJs/VDuOY6OKgRb4YfuiusZ5QKC1VyhJEBNFJYmPOrpQu2fl8sMVWops/5No9qMu+ayO32UDdnWfZ3s92eUe6PKroWE7Xoy5oocrhYMojE5WCeIlrdGUhUMcpEX1wNqlrnrSc9irgX8lAnWGISPwAlrjWMugTOzjIr6oX/nfZdksStFFktJkku1RUqSsOOBKV5q7aNECtfKRf2XlcwppUpDT/VIJ6ol2N6fxhubR7Mf65OBbJ4quCEP21fK3XdGQkqSrLSVlKLY/ff3XdqKDlr2Q2OosK4jT9g1ZyO6ZsFKOTN8dFFczzlnIRiict+5ym9QRf5Qm1Kk10dXKsT0rRzJDUb2Q61+/J2sEH9uHRZ7Z0IDHHX7jPx1HVG06jFYXjtkkcnrUUf4/J2TZ+ycHHMstA8uIomLeXQNFpJRocypQe1tH7wk5Y5loXWWEg4smcv/GjqCtcpgWdlSpYZqCBP9jLQMIzYtLakdokqCOSTS0B+ujSd9WBjngIZ7ZZ2kJRVL/aXQrU8PhrBCtRxT3x/U8qoQcveeD16aByK8UNk8nlf0ccxP3N6uOWsoOLjUOZzunsuyTAjBABMYUCMbOr2OlakDMyHLnEY0fKtKW1Waq1pRbSQ3kJ0K01gLPeiW+EwRckNtoaWnXImjbKW2M9t5WNVqQUNYkQQXQhYnxXPz42PZXsSz9+SAKixfPyawGsIszsq33X3fr/7gW5kzhiSAAULpu0uG0O67UdOv4pca6YprjajQ2GGnKglv4AkWtjq2tB+z7NnhuHduTG/uG2jwq85rtwlFVONJee1SpzLIcp0zWAp5+p6771vqi41ALp74Bsx+7UM/WsSPtjDiZ3SmRYw5gwVDznb7ibvvkYUZGEqS2no3Ex1UhFjFU2WQSGxlAOgMhv6osEySMANDwzvnIbEhGtkPtc1fJyL0x4NoxINVcoOZDyHrm1B77ZJJu+wqGCx2v3r3PWv4TsOFTlNHyujkg+mjxDOKzEesEzzUQG/9p1S2oriWkZAQAmVUCF2PVBKLMrbjuvAMwVBbRopplc3QiApJFVMG2U68qXQ65RW31t8P+UPbTAFt54s2d2yuPPXyZVzXk0GdKiZhBIPEUrAEF1lxbW3fLK+p740VX4jx6dVxBRZ1o1YlXlaop5yn95OXLhXFKctCWiJLlr47G1KLzQfSst47MkhNM95UVezKPBhnvbffaxrwbOdVkJX7auaLmnZ7nXHKMC4f+qe8PyqJQUrIIitOf+XSpdXuHLOgQ++jgBY8AbEUobA+EKyZU40/Xj9+6W47MKxmCWWZasQNWrVS3qtAiRvJ4ga82JGMXuOvI5d974/KxUcdqVmZYmhDSjI1Qj/pSHCHPS1Y3QrU5KqDwV+7dPdo7+2oMDElfIvR8tnG2JrH//pb+1SL3bUsEwywKEs4lAt8BavKDUwwsrH0AyZABYym9V7GecakIRvxoLnbhRkb8ogbyXvcd+bWk+70K6gJBjILiqJR+Liqx6CmBSVk0Q4GeSOdgdfab+ecdhQxhhbWLVg2Iab2gvXHf/NSsbvOsuCi4KLWWdqDd4ksMwnekCot653tjHMzYcpnweA+eeVOxTJ0U1v0VXa7dF1FW17pm1Brq0KiKCCLbHf9137zkidKU8C4NvElgkNqzcN+W5yifSf8Yx+7p9idclFUsaHmlGSuBm0TW8rDkuakoc5B1bFYlSzK3OCXzZdGWCddppWkvrdYLFOGlEoirTNC63fpBFHDw2owq+QUlwGgOTNYoCiy3emvf+ye/sFGiVwrDmnFdEJhC2N+W5wi73P+kfvvkkXFrKalxWVpB0+R5XTfDS+cJTtdc+bWCj7JTSlUJys0j2CbWez02gfIK5dpVdJKFKfvv/8uzzFGiVyrFF/5oCG0rQG/3Tbo5E9PnxM5UNa4AuqtHVQ5fkkQTSeLdbkGVI6V+mBd/6+RZUpG/dKy88HaNQzOK+CuoMu1a15Vjr1hY9WpDLZ7VT82qrPLKpWhyg4t6zEIeXqye27Q6NpiF+Lt9P9xzld+YGN+05wad/4/dvmjH7jtzSIHA6w3nFFjGoKJGBIk6rIz5ua/3EEYXYnGSHmvtnRywsgn8b3jydZmfWjltTczsIw1N0YZmSrfSpaLb4gluIAswLt89/yvX/noiBG10R7FmxoR/jlf+WEM+K1zauJV/I0rH/7QrXciI8Gkl6JUOgsEwSQZAKGsogVCuYJHTx3qx1W1LHZvkM5l1eX278BDeiV3SC1HaXZVy7ieEKRqFQ7sCUFDYVXaqgAXQp5mxbUPPPzh0WNp072LNzhGesRXjqMc4Yd3IT/88MW7brlTZPVG9VpnCVNhlesK2V4K3RBZWojpYJDNqJDt7Si5Tzz59EluKLQ6MAQ1JBWZK5nRRJVWWIa2ErIQvMuKax+6enH6+Nl6Z+Ntjhoe7WElTq38cn7o6sV7Xv8WkREzSRBQqS2wSrPSgWG1iaHaSodqwdWOFhtnWS2Dce3067O9ExzPu7VVLaxMqdXaVVAHg7Labl5wAS4gd1lx7a5HL4YaOYfR8XjL4yhPnDqkK3rro/de/K47Ic5CsNoQGazc90ZgSOpB81S0t15XSkZTEqEptZw2WC+27KWC9mJA81fm5hFkbdLVDgb1hl1gCbkTcpfJa/d8/GLwoX4w/XCL5MoTpw7suu78+MVLr/sB5OeEJBZZZWmpVdAAkVAFZ6rpQnBZWAvWbs8Wgri9LZJZuoqA3rAQbpaxm1zmtCA7RFa1sSCR1JvfGL5VGQnunr/4xKV44/yQuuWGyJUnTh3epf3AE5c+fPP3i/w8mKXy2csfwSQYElAlRKDSIWBiR1Vcht7KcL+EQt9WmNwTHro3HzTYZBlYKqGhuWmzmb4gwTshd9nuuUtPfiT2ID+8Lrp+cuWJUwd5dW9+8iNEdP/rfhiCGblZyI4hNKQMqaUgVSc/mFaTKceosbXOsEJ+DG5qrirZynbZtVFFVe4CmcLKyGBgPSGoaPWxJz405/A+yB7Lax2SeYLUAV/m9z7xoQe+/QeRMZAziETlZ6F04gEQoTS2bA++DBIZVUlSbsmLWnDx4BLJTI7KyGxkh7Zc9rr2MTNI6kR5SSQhJbgQvBPF6f1P3T3/2D7sDrwq2ZUnTh32lX7PU3f/1mvfUm4azVKwyJiYIUrznStawfTgze0LlS5CvZUhkVm+wXfYuoJBboaB+p/NNNFWEkOdwQBZgKWQO1Fcf+AT9y44pA++P6+BXHni1MFf73d/4t4HvvX7cHIDRA7JjEwFhmBAkEGr2tXS7rsSWXV4qP7Jxoatvf25t54M23Y7m/LKLh3DpsKq0xfAheBCyF1++mcPfPq+xcfzkfTtBcmVJ04dwyV/z6fvI6Irr3krxAmE5FJxQTBKMKlteAwPvtqcgvTzZu5oPVPIliojU3qhdR+ac4XMJr9gbXJDTZfdzrRClRoqTy9/8p5VjeTj6erzkytPnDqeC7/tk/dcftX3IT8PkbPILKmlVvDAcLVIKa/asYImFLsWFQ4MCd0uuyGv2FrVXO/QVeUuyF2+e+7y0/etcBgfW7efjVx54tRRXfvtT99HRI/+pTtJnIGQLLTUojJCRMPVYoKqU1omOhjbUhhZD/0po82OrbdKNHJEXf46TIVlpi/IQsgik9cf/ezFlQ/gIxwFscmVH+5YRaJVV3v9Zy8R0ROvuhPiREutMkIsl+/YTjyVyQvVA3OOUJet6bsB7s3o0UzC4nqWsHKsmmFgKaxOH3/64iZu9qLY4jVce/DLz4OMtWPWU9u9Ca97+iIRPXXhLchyRoktlOQyzSwj6QE1qlD5VGxUrUFPDRk0OjM3SlyRmbhAVgDIqu5CsXvq2Xs31zEWihCxnssPcUJcAStx6qjj329/9l4i+sQr7jSwJRgAmk68rj+jnXgyNj30VliwN6CvkkKb/rqVEVqIYveJz13c7k3mNF6mkgvjQ8LEqcO7G6/93EUi+tTL34zspDK2AKFzHUo/nio/niydRZUx1dyVty2syJ4cZMO60vVC63lAWYji9FO/++GDGbFp7EwkV35sIzOhqqf9ZY2GZ15+J0TOECxEmfRgZGxRO0i0l0ajEQxWT7UDQINZUjlWUpaJoM/87sVDHatpKI0mV36EwzLRam97pYbFF775ThKZUJa85W3VNhbId2kOk1WEz/aqBEshiy/8/sVjGKhpWI0jV544lVDV075F4+NL3/TXOMsZmfK2FLwIJrmox8JqOlZKUpUuVbH74v/56BEO0TTKhpIrP+bRmGjl315iA+WPX/z9LDKUs4qWJW/eJ7VgsIZUtQxQFn/05Y+k7pSk1lBy5YlTCVUj2gs9cCOJiKhINytJrXDkytOdSrRKLWFrK7dIpBuxF1WpG6U2s5pIravl6RYkVZVaklpbaUlhJVqllqRWUlgJVamllqRWUliJVqklqZUUVkJVaqklqZUUVqJVaqklqZUUVkJVaklqJYWVaJVaaklqJYWVUJVaaklqJYWVaJXacWLrCNXWcQErrbNJLUWIKSRMqiq11FKEmBRWolVqqSWpdTwKK6EqtSS1ksJKtEottSS1ksJKqEottSS1jkphJVqlltqhSq2DUlgJVamldthS63AUVqJVaqkdvNQ6BIWVUJVaakcitTavsBKtUkvNH1tbV1sbBlZaZ5NaascWIW4yJEycSi2144wQt6ewEq1SS+1opdaWFFZCVWqpHbnU2ozCSrRKLbUktTagsBKqUkstSa1tKKxEq9RSS1JrAworoSq11JLU2obCSrRKLbUktTagsBKqUkstSa1tKKxEq9RSWxu2VqW21gKstM4mtdRShLgNYCVUpZZaklobAFYSVqmllqSWf1vMdE+cSi217TJrqfG7jMJKtEottSS1NqCwEqpSSy1JrW0orESr1FJLUmsDCiuhKrXUktTahsJKtEottSS1NqCwEqpSSy1JrW0orESr1FI7TmzFU1tRgJXSQVNLLWFrG8BKqEottdQiSa3/D/Lkc1nqYN2BAAAAAElFTkSuQmCC)


## An Interval Class
Before we continue, we'll implement an interval class to manage real-valued intervals with a minimum
and a maximum. We'll end up using this class quite often as we proceed.

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #ifndef INTERVAL_H
    #define INTERVAL_H

    class interval {
      public:
        double min, max;

        interval() : min(+infinity), max(-infinity) {} // Default interval is empty

        interval(double min, double max) : min(min), max(max) {}

        double size() const {
            return max - min;
        }

        bool contains(double x) const {
            return min <= x && x <= max;
        }

        bool surrounds(double x) const {
            return min < x && x < max;
        }

        static const interval empty, universe;
    };

    const interval interval::empty    = interval(+infinity, -infinity);
    const interval interval::universe = interval(-infinity, +infinity);

    #endif
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [interval-initial]: <kbd>[interval.h]</kbd> Introducing the new interval class]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    // Common Headers

    #include "color.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
    #include "interval.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    #include "ray.h"
    #include "vec3.h"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [interval-rtweekend]: <kbd>[rtweekend.h]</kbd> Including the new interval class]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    class hittable {
      public:
        ...
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        virtual bool hit(const ray& r, interval ray_t, hit_record& rec) const = 0;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    };
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [hittable-with-interval]: <kbd>[hittable.h]</kbd> hittable::hit() using interval]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    class hittable_list : public hittable {
      public:
        ...
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        bool hit(const ray& r, interval ray_t, hit_record& rec) const override {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
            hit_record temp_rec;
            bool hit_anything = false;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
            auto closest_so_far = ray_t.max;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++

            for (const auto& object : objects) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
                if (object->hit(r, interval(ray_t.min, closest_so_far), temp_rec)) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
                    hit_anything = true;
                    closest_so_far = temp_rec.t;
                    rec = temp_rec;
                }
            }

            return hit_anything;
        }
        ...
    };
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [hittable-list-with-interval]: <kbd>[hittable_list.h]</kbd> hittable_list::hit() using interval]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    class sphere : public hittable {
      public:
        ...
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        bool hit(const ray& r, interval ray_t, hit_record& rec) const override {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
            ...

            // Find the nearest root that lies in the acceptable range.
            auto root = (h - sqrtd) / a;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
            if (!ray_t.surrounds(root)) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
                root = (h + sqrtd) / a;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
                if (!ray_t.surrounds(root))
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
                    return false;
            }
            ...
        }
        ...
    };
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [sphere-with-interval]: <kbd>[sphere.h]</kbd> sphere using interval]


    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
    color ray_color(const ray& r, const hittable& world) {
        hit_record rec;
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++ highlight
        if (world.hit(r, interval(0, infinity), rec)) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ C++
            return 0.5 * (rec.normal + color(1,1,1));
        }

        vec3 unit_direction = unit_vector(r.direction());
        auto a = 0.5*(unit_direction.y() + 1.0);
        return (1.0-a)*color(1.0, 1.0, 1.0) + a*color(0.5, 0.7, 1.0);
    }
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    [Listing [main-with-interval]: <kbd>[main.cc]</kbd> The new main using interval]
