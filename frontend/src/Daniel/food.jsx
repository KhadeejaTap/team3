import { apiFetch as fetch } from '../api';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const API = 'http://localhost:5000/api';
const MENU_CATEGORIES = [
  'Entree',
  'Side',
  'Beverage',
];
const MAX_STALL_IMAGE_BYTES = 10 * 1024 * 1024;
const STALL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function loadStallImage(stallId) {
  const response = await fetch(`${API}/food-stalls/${stallId}/image`);

  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load a food stall image.');

  const image = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read a food stall image.'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read a food stall image.'));
    reader.readAsDataURL(image);
  });
}

async function getFoodData() {
  const responses = await Promise.all([
    fetch(`${API}/food-stalls`),
    fetch(`${API}/menu-items`)
  ]);

  if (responses.some(response => !response.ok)) {
    throw new Error('Could not load food stalls and menu items.');
  }

  const [stalls, items] = await Promise.all(
    responses.map(response => response.json())
  );

  const stallsWithImages = await Promise.all(
    stalls.map(async stall => {
      try {
        return {
          ...stall,
          image: await loadStallImage(stall.stall_ID)
        };
      } catch {
        return {
          ...stall,
          image: null,
          imageError: true
        };
      }
    })
  );

  return { stalls: stallsWithImages, items };
}

async function sendFoodRequest(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || fallbackMessage);
  }

  return result;
}

function inputTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

function displayTime(value) {
  const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)/);

  if (!match) return '';

  const hour = Number(match[1]);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${match[2]} ${period}`;
}

export default function Food({ role, userDept }) {
  const { stallId } = useParams();
  const effectiveDept = userDept != null
    ? Number(userDept)
    : Number(localStorage.getItem('user_dept'));
  const canManage = role === 'manager' && effectiveDept === 3;

  const [stalls, setStalls] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingStall, setEditingStall] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selectedStall = stalls.find(stall => String(stall.stall_ID) === stallId);
  const visibleItems = selectedStall
    ? items.filter(item => Number(item.stall_ID) === Number(selectedStall.stall_ID))
    : [];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getFoodData();

        if (!cancelled) {
          setStalls(data.stalls);
          setItems(data.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function addStall(event) {
    event.preventDefault();
    if (saving || !canManage) return;

    const form = event.currentTarget;
    const fields = new FormData(form);
    const stall = {
      name: fields.get('name').trim(),
      location: fields.get('location').trim(),
      opening_time: fields.get('opening_time'),
      closing_time: fields.get('closing_time')
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result = await sendFoodRequest(
        `${API}/food-stalls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stall)
        },
        'Could not add food stall.'
      );

      setStalls(previous => [
        ...previous,
        { ...stall, stall_ID: result.stall_ID, image: null }
      ]);
      form.reset();
      setMessage('Food stall added successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStall(event, stallId) {
    event.preventDefault();
    if (saving || !canManage) return;

    const form = event.currentTarget;
    const fields = new FormData(form);
    const stall = {
      name: fields.get('name').trim(),
      location: fields.get('location').trim(),
      opening_time: fields.get('opening_time'),
      closing_time: fields.get('closing_time')
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await sendFoodRequest(
        `${API}/food-stalls/${stallId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stall)
        },
        'Could not update food stall.'
      );

      setStalls(previous => previous.map(entry => (
        entry.stall_ID === stallId ? { ...entry, ...stall } : entry
      )));
      setItems(previous => previous.map(item => (
        item.stall_ID === stallId
          ? { ...item, stall_name: stall.name }
          : item
      )));
      setEditingStall(null);
      setMessage('Food stall updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeStall(stallId) {
    if (
      saving ||
      !canManage ||
      !window.confirm('Remove this food stall?')
    ) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await sendFoodRequest(
        `${API}/food-stalls/${stallId}`,
        { method: 'DELETE' },
        'Could not remove food stall.'
      );
      setStalls(previous => previous.filter(stall => stall.stall_ID !== stallId));
      setEditingStall(null);
      setMessage('Food stall removed successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadStallImage(event, stallId) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || saving || !canManage) return;

    if (!STALL_IMAGE_TYPES.includes(file.type)) {
      setError('Choose a JPEG, PNG, WebP, or GIF image.');
      input.value = '';
      return;
    }

    if (file.size > MAX_STALL_IMAGE_BYTES) {
      setError('Choose an image no larger than 10 MB.');
      input.value = '';
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Could not read the selected image.'));
          }
        };
        reader.onerror = () => reject(new Error('Could not read the selected image.'));
        reader.readAsDataURL(file);
      });

      await sendFoodRequest(
        `${API}/food-stalls/${stallId}/image`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image })
        },
        'Could not save food stall image.'
      );
      setStalls(previous => previous.map(stall => (
        stall.stall_ID === stallId ? { ...stall, image } : stall
      )));
      setMessage('Food stall image saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      input.value = '';
      setSaving(false);
    }
  }

  async function removeStallImage(stallId) {
    if (
      saving ||
      !canManage ||
      !window.confirm('Remove this food stall image?')
    ) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await sendFoodRequest(
        `${API}/food-stalls/${stallId}/image`,
        { method: 'DELETE' },
        'Could not remove food stall image.'
      );
      setStalls(previous => previous.map(stall => (
        stall.stall_ID === stallId ? { ...stall, image: null } : stall
      )));
      setMessage('Food stall image removed successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addMenuItem(event) {
    event.preventDefault();
    if (saving || !canManage) return;

    const form = event.currentTarget;
    const fields = new FormData(form);
    const item = {
      name: fields.get('name').trim(),
      category: fields.get('category').trim(),
      price: fields.get('price'),
      stall_ID: Number(fields.get('stall_ID'))
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result = await sendFoodRequest(
        `${API}/menu-items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        },
        'Could not add menu item.'
      );
      const stall = stalls.find(entry => entry.stall_ID === item.stall_ID);

      setItems(previous => [
        ...previous,
        {
          ...item,
          item_ID: result.item_ID,
          stall_name: stall?.name || ''
        }
      ]);
      form.reset();
      setMessage('Menu item added successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateMenuItem(event, itemId) {
    event.preventDefault();
    if (saving || !canManage) return;

    const form = event.currentTarget;
    const fields = new FormData(form);
    const item = {
      name: fields.get('name').trim(),
      category: fields.get('category').trim(),
      price: fields.get('price'),
      stall_ID: Number(fields.get('stall_ID'))
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await sendFoodRequest(
        `${API}/menu-items/${itemId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        },
        'Could not update menu item.'
      );
      const stall = stalls.find(entry => entry.stall_ID === item.stall_ID);

      setItems(previous => previous.map(entry => (
        entry.item_ID === itemId
          ? { ...entry, ...item, stall_name: stall?.name || '' }
          : entry
      )));
      setEditingItem(null);
      setMessage('Menu item updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeMenuItem(itemId) {
    if (
      saving ||
      !canManage ||
      !window.confirm('Remove this menu item?')
    ) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await sendFoodRequest(
        `${API}/menu-items/${itemId}`,
        { method: 'DELETE' },
        'Could not remove menu item.'
      );
      setItems(previous => previous.filter(item => item.item_ID !== itemId));
      setEditingItem(null);
      setMessage('Menu item removed successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderStallFields(stall) {
    return (
      <>
        <p>
          <label>
            Stall name<br />
            <input name="name" maxLength={100} defaultValue={stall?.name || ''} required />
          </label>
        </p>
        <p>
          <label>
            Location<br />
            <input name="location" maxLength={100} defaultValue={stall?.location || ''} required />
          </label>
        </p>
        <p>
          <label>
            Opening time<br />
            <input name="opening_time" type="time" defaultValue={inputTime(stall?.opening_time)} required />
          </label>
        </p>
        <p>
          <label>
            Closing time<br />
            <input name="closing_time" type="time" defaultValue={inputTime(stall?.closing_time)} required />
          </label>
        </p>
      </>
    );
  }

  function renderStallImage(stall) {
    return (
      <>
        <div className="food-stall-image-placeholder">
          {stall.image ? (
            <img src={stall.image} alt={`${stall.name}`} />
          ) : (
            <span>
              {stall.imageError ? 'Image could not be loaded' : 'Stall image'}
            </span>
          )}
        </div>
        {canManage && (
          <div className="food-stall-image-actions">
            <label>
              {stall.image ? 'Change image' : 'Add image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={saving}
                onChange={event => uploadStallImage(event, stall.stall_ID)}
              />
            </label>
            {stall.image && (
              <button
                type="button"
                disabled={saving}
                onClick={() => removeStallImage(stall.stall_ID)}
              >
                Remove image
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  function renderItemFields(item, defaultStallId = '') {
    return (
      <>
        <p>
          <label>
            Food stall<br />
            <select
              name="stall_ID"
              required
              defaultValue={item?.stall_ID || defaultStallId}
            >
              <option value="" disabled>Select a food stall</option>
              {stalls.map(stall => (
                <option key={stall.stall_ID} value={stall.stall_ID}>
                  {stall.name}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Item name<br />
            <input name="name" maxLength={100} defaultValue={item?.name || ''} required />
          </label>
        </p>
        <p>
          <label>
            Category<br />
            <select
              name="category"
              required
              defaultValue={item?.category || ''}
            >
              <option value="" disabled>Select a category</option>
              {item?.category && !MENU_CATEGORIES.includes(item.category) && (
                <option value={item.category}>{item.category}</option>
              )}
              {MENU_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Price ($)<br />
            <input
              name="price"
              type="number"
              min="0"
              max="999999.99"
              step="0.01"
              defaultValue={item?.price ?? ''}
              required
            />
          </label>
        </p>
      </>
    );
  }

  return (
    <section>
      <h1>{selectedStall ? selectedStall.name : 'Zoo Food Stalls'}</h1>

      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {stallId && !loading && !selectedStall && (
        <>
          <p>Food stall not found.</p>
          <Link to="/food">Back to Food &amp; Dining</Link>
        </>
      )}

      {selectedStall && (
        <>
          <p><Link to="/food">← All food stalls</Link></p>
          {editingStall === selectedStall.stall_ID ? (
            <form onSubmit={event => updateStall(event, selectedStall.stall_ID)}>
              <h2>Edit Food Stall</h2>
              <fieldset disabled={saving}>
                <legend>Food stall details</legend>
                {renderStallFields(selectedStall)}
                <button type="submit">{saving ? 'Saving...' : 'Save Stall'}</button>
                <button type="button" onClick={() => setEditingStall(null)}>Cancel</button>
              </fieldset>
            </form>
          ) : (
            <article>
              {renderStallImage(selectedStall)}
              <p>Location: {selectedStall.location}</p>
              <p>
                Hours: {displayTime(selectedStall.opening_time)} – {displayTime(selectedStall.closing_time)}
              </p>
              {canManage && (
                <>
                  <button type="button" disabled={saving} onClick={() => setEditingStall(selectedStall.stall_ID)}>
                    Edit Stall
                  </button>
                  <button type="button" disabled={saving} onClick={() => removeStall(selectedStall.stall_ID)}>
                    Remove Stall
                  </button>
                </>
              )}
            </article>
          )}
        </>
      )}

      {!stallId && stalls.map(stall => (
        <article key={stall.stall_ID}>
          {editingStall === stall.stall_ID ? (
            <form
              key={stall.stall_ID}
              onSubmit={event => updateStall(event, stall.stall_ID)}
            >
              <h2>Edit Food Stall</h2>
              <fieldset disabled={saving}>
                <legend>Food stall details</legend>
                {renderStallFields(stall)}
                <button type="submit">{saving ? 'Saving...' : 'Save Stall'}</button>
                <button type="button" onClick={() => setEditingStall(null)}>Cancel</button>
              </fieldset>
            </form>
          ) : (
            <>
              {renderStallImage(stall)}
              <h2>
                <Link
                  className="food-stall-link"
                  to={`/food/stalls/${stall.stall_ID}`}
                >
                  {stall.name}
                </Link>
              </h2>
              <p>Location: {stall.location}</p>
              <p>
                Hours: {displayTime(stall.opening_time)} – {displayTime(stall.closing_time)}
              </p>
              {canManage && (
                <>
                  <button type="button" disabled={saving} onClick={() => setEditingStall(stall.stall_ID)}>
                    Edit Stall
                  </button>
                  <button type="button" disabled={saving} onClick={() => removeStall(stall.stall_ID)}>
                    Remove Stall
                  </button>
                </>
              )}
            </>
          )}
        </article>
      ))}

      {!loading && !stallId && stalls.length === 0 && <p>No food stalls available yet.</p>}

      {!loading && !stallId && canManage && (
        <form onSubmit={addStall} style={{ maxWidth: 420, margin: '30px auto' }}>
          <h2>Add Food Stall</h2>
          <fieldset disabled={saving}>
            <legend>Food stall details</legend>
            {renderStallFields()}
            <button type="submit">{saving ? 'Saving...' : 'Add Food Stall'}</button>
          </fieldset>
        </form>
      )}

      {selectedStall && (
        <>
          <h2>Menu</h2>

          {!loading && visibleItems.length === 0 && (
            <p>No menu items available for this stall yet.</p>
          )}

          {visibleItems.map(item => (
            <article key={item.item_ID}>
              {editingItem === item.item_ID ? (
                <form
                  key={item.item_ID}
                  onSubmit={event => updateMenuItem(event, item.item_ID)}
                >
                  <h3>Edit Menu Item</h3>
                  <fieldset disabled={saving}>
                    <legend>Menu item details</legend>
                    {renderItemFields(item)}
                    <button type="submit">{saving ? 'Saving...' : 'Save Item'}</button>
                    <button type="button" onClick={() => setEditingItem(null)}>Cancel</button>
                  </fieldset>
                </form>
              ) : (
                <>
                  <h3>{item.name}</h3>
                  <p>Category: {item.category}</p>
                  <p>Price: ${Number(item.price).toFixed(2)}</p>
                  {canManage && (
                    <>
                      <button type="button" disabled={saving} onClick={() => setEditingItem(item.item_ID)}>
                        Edit Item
                      </button>
                      <button type="button" disabled={saving} onClick={() => removeMenuItem(item.item_ID)}>
                        Remove Item
                      </button>
                    </>
                  )}
                </>
              )}
            </article>
          ))}

          {!loading && canManage && (
            <form onSubmit={addMenuItem} style={{ maxWidth: 420, margin: '30px auto' }}>
              <h2>Add Menu Item</h2>
              <fieldset disabled={saving}>
                <legend>Menu item details</legend>
                {renderItemFields(null, selectedStall.stall_ID)}
                <button type="submit">{saving ? 'Saving...' : 'Add Menu Item'}</button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
